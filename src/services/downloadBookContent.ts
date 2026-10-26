import { database } from '../data/database'
import { getContentSections } from '../data/contentRepository'
import type { ContentDownloadProgress } from '../models/content'
import type { ContentTransport } from '../api-client/resources/contentApi'
import type { AppDispatch } from '../store/store'
import {
  recordSectionBatch,
  recordSegmentBatch,
  type BookRequest,
} from '../store/bookDownloadsSlice'

export class ContentVersionChangedError extends Error {}

export function hasContentVersionChanged(error: unknown) {
  if (error instanceof ContentVersionChangedError) return true
  if (
    !error ||
    typeof error !== 'object' ||
    !('status' in error) ||
    error.status !== 412
  )
    return false
  const data =
    'data' in error ? (error.data as { error?: { code?: string } }) : undefined
  return data?.error?.code === 'content_version_mismatch'
}

function checkBatchProgress(
  pageVersion: string,
  version: string,
  offset: number,
  count: number,
  nextOffset: number | null,
  expectedCount: number,
) {
  if (pageVersion !== version) throw new ContentVersionChangedError()
  if (offset + count > expectedCount)
    throw new Error('Download exceeded expected row count')
  if (nextOffset !== null && (count === 0 || nextOffset !== offset + count)) {
    throw new Error('Download offset did not advance correctly')
  }
  if (nextOffset === null && offset + count !== expectedCount)
    throw new Error('Incomplete download')
}

export type BookDownloadContext = BookRequest & {
  version: string
  progress: ContentDownloadProgress
  transport: ContentTransport
  dispatch: AppDispatch
  signal: AbortSignal
}

export async function downloadBookSections(
  context: BookDownloadContext,
  expectedCount: number,
) {
  const { bookId, requestId, version, transport, dispatch, signal } = context
  const rootSectionIds = new Map<number, number>()
  let offset = context.progress.sectionNextOffset

  // Rebuild root ownership from the already committed preorder before continuing
  // a section stream. Completed sections need no further HTTP requests.
  if (offset !== 0) {
    const storedSections = await getContentSections(bookId)
    signal.throwIfAborted()

    for (const row of storedSections) {
      rootSectionIds.set(
        row.id,
        row.parent_id === null ? row.id : rootSectionIds.get(row.parent_id)!,
      )
    }
  }

  while (offset !== null) {
    signal.throwIfAborted()
    const page = await transport.fetchSectionBatch(
      bookId,
      version,
      offset,
      signal,
    )
    signal.throwIfAborted()
    checkBatchProgress(
      page.content_version,
      version,
      offset,
      page.items.length,
      page.next_offset,
      expectedCount,
    )

    for (const row of page.items) {
      rootSectionIds.set(
        row.id,
        row.parent_id === null ? row.id : rootSectionIds.get(row.parent_id)!,
      )
    }
    // Rows and their resume offset must commit together, including on close.
    await database.transaction(
      'rw',
      [database.sections, database.content],
      async () => {
        await database.sections.bulkAdd(
          page.items.map((row) => ({ ...row, bookId, version })),
        )
        await database.content.update(bookId, {
          'progress.sectionNextOffset': page.next_offset,
        })
      },
    )
    signal.throwIfAborted()
    dispatch(
      recordSectionBatch({
        bookId,
        requestId,
        count: page.items.length,
        complete: page.next_offset === null,
      }),
    )

    offset = page.next_offset
  }

  return rootSectionIds
}

export async function downloadBookSegments(
  context: BookDownloadContext,
  expectedCount: number,
  sectionDownload: Promise<Map<number, number>>,
) {
  const { bookId, requestId, version, transport, dispatch, signal } = context
  let offset = context.progress.segmentNextOffset
  let lastSequence = context.progress.lastSegmentSequence

  while (offset !== null) {
    signal.throwIfAborted()
    const page = await transport.fetchSegmentBatch(
      bookId,
      version,
      offset,
      signal,
    )
    signal.throwIfAborted()
    checkBatchProgress(
      page.content_version,
      version,
      offset,
      page.items.length,
      page.next_offset,
      expectedCount,
    )

    // Both requests start together; root ownership is resolved before storing text.
    const rootSectionIds = await sectionDownload
    signal.throwIfAborted()
    lastSequence = page.items.at(-1)?.sequence ?? lastSequence

    await database.transaction(
      'rw',
      [database.segments, database.content],
      async () => {
        await database.segments.bulkAdd(
          page.items.map((row) => ({
            ...row,
            bookId,
            version,
            root_section_id:
              row.section_id === null
                ? null
                : rootSectionIds.get(row.section_id)!,
          })),
        )
        await database.content.update(bookId, {
          'progress.segmentNextOffset': page.next_offset,
          'progress.lastSegmentSequence': lastSequence,
        })
      },
    )
    signal.throwIfAborted()
    dispatch(
      recordSegmentBatch({
        bookId,
        requestId,
        count: page.items.length,
        lastSequence,
      }),
    )

    offset = page.next_offset
  }
}

export async function downloadBookContent(
  context: BookDownloadContext,
  sectionCount: number,
  segmentCount: number,
) {
  // A failed stream cancels its sibling without cancelling a version-change retry.
  const controller = new AbortController()
  const abort = () => controller.abort()
  context.signal.addEventListener('abort', abort, { once: true })
  if (context.signal.aborted) abort()

  try {
    const childContext = { ...context, signal: controller.signal }
    const sections = downloadBookSections(childContext, sectionCount)
    const segments = downloadBookSegments(childContext, segmentCount, sections)

    const results = await Promise.allSettled(
      [sections, segments].map(async (work) => {
        try {
          await work
        } catch (error) {
          // If one of the requests fails, abort the other request
          controller.abort()
          throw error
        }
      }),
    )
    context.signal.throwIfAborted()

    const failures = results.filter((result) => result.status === 'rejected')
    const failure =
      failures.find((result) => hasContentVersionChanged(result.reason)) ??
      failures.find((result) => result.reason?.name !== 'AbortError') ??
      failures[0]
    if (failure) throw failure.reason
  } finally {
    context.signal.removeEventListener('abort', abort)
  }
}
