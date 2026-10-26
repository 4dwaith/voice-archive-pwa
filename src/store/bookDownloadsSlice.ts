import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type { ContentManifestOutput } from '../api-client/generated/schemas'

export type BookRequest = { bookId: number; requestId: string }
export type BookDownloadStatus =
  | 'idle'
  | 'loading'
  | 'partial'
  | 'ready'
  | 'offline'
  | 'empty'
  | 'error'
  | 'removing'

export type BookDownload = {
  status: BookDownloadStatus
  manifest: ContentManifestOutput | null
  sectionStoredCount: number
  segmentStoredCount: number
  sectionsComplete: boolean
  lastSegmentSequence: number | null
  error: string | null

  // The latest intent and the running operation differ while old writes settle.
  // This needs to be tracked at the book level to prevent multiple downloads of the same book.
  requestId: string | null // user intent - this is the download requested by the user
  activeRequestId: string | null // active download - this is the download currently being processed by the system
}

export type BookDownloadsState = {
  byBook: Record<number, BookDownload | undefined>
}

const initialState: BookDownloadsState = { byBook: {} }

function createBookRequest(bookId: number) {
  return { payload: { bookId, requestId: nanoid() } }
}

function createBookDownload(): BookDownload {
  return {
    status: 'idle',
    manifest: null,
    sectionStoredCount: 0,
    segmentStoredCount: 0,
    sectionsComplete: false,
    lastSegmentSequence: null,
    error: null,
    requestId: null,
    activeRequestId: null,
  }
}

function prepareBookRequest(
  state: BookDownloadsState,
  request: BookRequest,
  isRemoval = false,
) {
  const entry = (state.byBook[request.bookId] ??= createBookDownload())
  // Duplicate load intents share the current download; no subscriber registry.
  if (
    !isRemoval &&
    entry.requestId &&
    (entry.status === 'loading' || entry.status === 'partial')
  )
    return

  entry.requestId = request.requestId
  entry.status = isRemoval ? 'removing' : 'loading'
  entry.error = null
}

function getActiveDownload(state: BookDownloadsState, request: BookRequest) {
  const entry = state.byBook[request.bookId]
  return entry?.requestId === request.requestId &&
    entry.activeRequestId === request.requestId
    ? entry
    : undefined
}

const bookDownloadsSlice = createSlice({
  name: 'bookDownloads',
  initialState,
  reducers: {
    requestBookLoad: {
      prepare: createBookRequest,
      reducer(state, action: PayloadAction<BookRequest>) {
        prepareBookRequest(state, action.payload)
      },
    },
    requestBookRetry: {
      prepare: createBookRequest,
      reducer(state, action: PayloadAction<BookRequest>) {
        prepareBookRequest(state, action.payload)
      },
    },
    requestBookRemoval: {
      prepare: createBookRequest,
      reducer(state, action: PayloadAction<BookRequest>) {
        prepareBookRequest(state, action.payload, true)
      },
    },
    requestBookClose(state, action: PayloadAction<number>) {
      const entry = state.byBook[action.payload]
      if (!entry) return
      state.byBook[action.payload] = {
        ...createBookDownload(),
        activeRequestId: entry.activeRequestId,
      }
    },
    recordBookRequestStart(state, action: PayloadAction<BookRequest>) {
      const entry = state.byBook[action.payload.bookId]
      if (entry?.requestId === action.payload.requestId)
        entry.activeRequestId = action.payload.requestId
    },
    recordBookManifest(
      state,
      action: PayloadAction<BookRequest & { manifest: ContentManifestOutput }>,
    ) {
      const entry = getActiveDownload(state, action.payload)
      if (!entry) return
      entry.manifest = action.payload.manifest
      entry.sectionStoredCount = 0
      entry.segmentStoredCount = 0
      entry.sectionsComplete = false
      entry.lastSegmentSequence = null
      entry.status = 'loading'
    },
    recordSectionBatch(
      state,
      action: PayloadAction<BookRequest & { count: number; complete: boolean }>,
    ) {
      const entry = getActiveDownload(state, action.payload)
      if (!entry) return
      entry.sectionStoredCount += action.payload.count
      entry.sectionsComplete = action.payload.complete
    },
    recordSegmentBatch(
      state,
      action: PayloadAction<
        BookRequest & { count: number; lastSequence: number | null }
      >,
    ) {
      const entry = getActiveDownload(state, action.payload)
      if (!entry) return
      entry.segmentStoredCount += action.payload.count
      if (action.payload.lastSequence !== null)
        entry.lastSegmentSequence = action.payload.lastSequence
      if (entry.segmentStoredCount > 0) entry.status = 'partial'
    },
    recordBookRequestSuccess(
      state,
      action: PayloadAction<
        BookRequest & {
          status: 'ready' | 'offline' | 'empty' | 'idle'
          manifest: ContentManifestOutput | null
        }
      >,
    ) {
      const entry = getActiveDownload(state, action.payload)
      if (!entry) return
      entry.status = action.payload.status
      entry.manifest = action.payload.manifest
      entry.sectionStoredCount = action.payload.manifest?.section_count ?? 0
      entry.segmentStoredCount = action.payload.manifest?.segment_count ?? 0
      entry.sectionsComplete =
        action.payload.status === 'ready' || action.payload.status === 'offline'
      if (action.payload.status === 'idle' || action.payload.status === 'empty')
        entry.lastSegmentSequence = null
    },
    recordBookRequestFailure(
      state,
      action: PayloadAction<BookRequest & { error: string }>,
    ) {
      const entry = getActiveDownload(state, action.payload)
      if (!entry) return
      entry.status = 'error'
      entry.error = action.payload.error
      entry.manifest = null
      entry.sectionStoredCount = 0
      entry.segmentStoredCount = 0
      entry.sectionsComplete = false
      entry.lastSegmentSequence = null
    },
    recordBookRequestCompletion(state, action: PayloadAction<BookRequest>) {
      const entry = state.byBook[action.payload.bookId]
      if (entry?.activeRequestId === action.payload.requestId)
        entry.activeRequestId = null
    },
  },
  selectors: {
    selectBookDownloadState(state, bookId: number) {
      return state.byBook[bookId]
    },
  },
})

export const {
  requestBookLoad,
  requestBookRetry,
  requestBookClose,
  requestBookRemoval,
  recordBookRequestStart,
  recordBookManifest,
  recordSectionBatch,
  recordSegmentBatch,
  recordBookRequestSuccess,
  recordBookRequestFailure,
  recordBookRequestCompletion,
} = bookDownloadsSlice.actions
export default bookDownloadsSlice.reducer

export const { selectBookDownloadState } = bookDownloadsSlice.selectors
