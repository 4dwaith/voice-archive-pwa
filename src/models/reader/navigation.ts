// Preserve a segment/code-point reading position across layout changes.
export type ReaderAnchor = { segmentId: number; offset: number }

// Tie reader state and asynchronous results to one book and content version.
export type ReaderScope = { bookId: number; contentVersion: string }

// Request an absolute or relative page within a chapter or the indexed book.
export type ReaderPageNavigationRequest = { scope: 'local' | 'global' } & (
  { kind: 'absolute'; pageNumber: number } | { kind: 'relative'; delta: number }
)
