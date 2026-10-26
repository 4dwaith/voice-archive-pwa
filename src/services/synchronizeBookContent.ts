import type { ContentManifestOutput } from '../api-client/generated/schemas'
import { apiBaseUrl } from '../api-client/baseApi'
import type { ContentTransport } from '../api-client/resources/contentApi'
import { database } from '../data/database'
import {
  deleteLocalContent,
  initializeContentStaging,
} from '../data/contentRepository'
import type { AppDispatch } from '../store/store'
import {
  recordBookManifest,
  recordSectionBatch,
  recordSegmentBatch,
  recordBookRequestSuccess,
  type BookRequest,
} from '../store/bookDownloadsSlice'
import {
  downloadBookContent,
  hasContentVersionChanged,
  ContentVersionChangedError,
} from './downloadBookContent'

export function isNetworkFailure(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 'FETCH_ERROR'
  )
}

export function isBookMissing(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 404
  )
}

function normalizeManifestFileUrls(
  manifest: ContentManifestOutput,
): ContentManifestOutput {
  return {
    ...manifest,
    files: manifest.files.map((file) => ({
      ...file,
      url: new URL(file.url, apiBaseUrl).href,
    })),
  }
}

export async function synchronizeBookContent(
  request: BookRequest,
  transport: ContentTransport,
  dispatch: AppDispatch,
  signal: AbortSignal,
) {
  const { bookId } = request
  // Repeated publication changes must eventually become a recoverable error.
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted()
    const cached = await database.content.get(bookId)
    signal.throwIfAborted()

    try {
      let manifest: ContentManifestOutput
      try {
        manifest = normalizeManifestFileUrls(
          await transport.fetchContentManifest(bookId, signal),
        )
      } catch (error) {
        signal.throwIfAborted()
        if (cached?.complete && isNetworkFailure(error)) {
          dispatch(
            recordBookRequestSuccess({
              ...request,
              status: 'offline',
              manifest: cached.manifest,
            }),
          )
          return
        }
        throw error
      }
      signal.throwIfAborted()
      dispatch(recordBookManifest({ ...request, manifest }))

      if (manifest.state !== 'published' || manifest.segment_count === 0) {
        await deleteLocalContent(bookId)
        signal.throwIfAborted()
        dispatch(
          recordBookRequestSuccess({
            ...request,
            status: 'empty',
            manifest,
          }),
        )
        return
      }

      const version = manifest.content_version!
      if (cached?.version !== version) await deleteLocalContent(bookId)
      signal.throwIfAborted()

      if (cached?.complete && cached.version === version) {
        dispatch(
          recordBookRequestSuccess({
            ...request,
            status: 'ready',
            manifest,
          }),
        )
        return
      }

      const progress =
        cached?.version === version && cached.progress
          ? cached.progress
          : {
              sectionNextOffset: 0,
              segmentNextOffset: 0,
              lastSegmentSequence: null,
            }

      if (cached?.version !== version || !cached.progress) {
        await initializeContentStaging({
          bookId,
          version,
          manifest,
          complete: false,
          progress,
        })
      }
      signal.throwIfAborted()
      // Restore durable progress after a refresh or retry before new batches arrive.
      dispatch(
        recordSectionBatch({
          ...request,
          count: progress.sectionNextOffset ?? manifest.section_count,
          complete: progress.sectionNextOffset === null,
        }),
      )
      dispatch(
        recordSegmentBatch({
          ...request,
          count: progress.segmentNextOffset ?? manifest.segment_count,
          lastSequence: progress.lastSegmentSequence,
        }),
      )

      await downloadBookContent(
        { ...request, version, progress, transport, dispatch, signal },
        manifest.section_count,
        manifest.segment_count,
      )
      signal.throwIfAborted()

      const current = await transport.fetchContentManifest(bookId, signal)
      signal.throwIfAborted()
      if (
        current.content_version !== version ||
        current.state !== 'published'
      ) {
        throw new ContentVersionChangedError()
      }
      await database.content.update(bookId, { manifest, complete: true })
      signal.throwIfAborted()
      dispatch(
        recordBookRequestSuccess({ ...request, status: 'ready', manifest }),
      )
      return
    } catch (error) {
      if (hasContentVersionChanged(error) || isBookMissing(error)) {
        await deleteLocalContent(bookId)
      }
      signal.throwIfAborted()
      if (!hasContentVersionChanged(error)) throw error
      if (attempt === 2)
        throw new Error('Book content kept changing. Please try again.')
    }
  }
}
