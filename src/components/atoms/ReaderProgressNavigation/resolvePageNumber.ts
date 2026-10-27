import type { ReaderPageNavigation } from '../../../models/reader'

export function resolvePageNumber(
  requestedPage: number,
  pageCount: number | null,
  kind: ReaderPageNavigation['kind'],
): { pageNumber: number | null; error: string | null } {
  if (pageCount === null)
    return { pageNumber: null, error: 'Page range is not known yet.' }
  if (pageCount === 0)
    return { pageNumber: null, error: 'No pages are available.' }

  if (
    kind === 'absolute' &&
    (!Number.isSafeInteger(requestedPage) ||
      requestedPage < 1 ||
      requestedPage > pageCount)
  )
    return {
      pageNumber: null,
      error: `Enter a whole page number from 1 to ${pageCount}.`,
    }

  return {
    pageNumber: Math.max(1, Math.min(requestedPage, pageCount)),
    error: null,
  }
}
