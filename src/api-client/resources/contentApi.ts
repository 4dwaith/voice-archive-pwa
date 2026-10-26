import { archiveApi } from '../archiveApi'
import type { AppDispatch } from '../../store/store'
import type {
  ContentManifestOutput,
  SectionPageOutput,
  SegmentPageOutput,
} from '../generated/schemas'

// Each validated batch is transferred to Dexie, then released from RTK's cache.
export const contentApi = archiveApi.enhanceEndpoints({
  endpoints: {
    getApiV1BookContent: { keepUnusedDataFor: 0 },
    listApiV1BookSections: { keepUnusedDataFor: 0 },
    listApiV1BookSegments: { keepUnusedDataFor: 0 },
  },
})

export type ContentTransport = {
  fetchContentManifest(
    bookId: number,
    signal: AbortSignal,
  ): Promise<ContentManifestOutput>
  fetchSectionBatch(
    bookId: number,
    version: string,
    offset: number,
    signal: AbortSignal,
  ): Promise<SectionPageOutput>
  fetchSegmentBatch(
    bookId: number,
    version: string,
    offset: number,
    signal: AbortSignal,
  ): Promise<SegmentPageOutput>
}

export function createContentTransport(
  dispatch: AppDispatch,
): ContentTransport {
  return {
    async fetchContentManifest(bookId: number, signal: AbortSignal) {
      const request = dispatch(
        contentApi.endpoints.getApiV1BookContent.initiate(
          { bookId },
          { forceRefetch: true },
        ),
      )
      const abort = () => request.abort()
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      try {
        return await request.unwrap()
      } finally {
        signal.removeEventListener('abort', abort)
        request.unsubscribe()
      }
    },
    async fetchSectionBatch(
      bookId: number,
      contentVersion: string,
      offset: number,
      signal: AbortSignal,
    ) {
      const request = dispatch(
        contentApi.endpoints.listApiV1BookSections.initiate(
          { bookId, 'if-content-version': contentVersion, offset, limit: 2000 },
          { forceRefetch: true },
        ),
      )
      const abort = () => request.abort()
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      try {
        return await request.unwrap()
      } finally {
        signal.removeEventListener('abort', abort)
        request.unsubscribe()
      }
    },
    async fetchSegmentBatch(
      bookId: number,
      contentVersion: string,
      offset: number,
      signal: AbortSignal,
    ) {
      const request = dispatch(
        contentApi.endpoints.listApiV1BookSegments.initiate(
          { bookId, 'if-content-version': contentVersion, offset, limit: 500 },
          { forceRefetch: true },
        ),
      )
      const abort = () => request.abort()
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      try {
        return await request.unwrap()
      } finally {
        signal.removeEventListener('abort', abort)
        request.unsubscribe()
      }
    },
  }
}
