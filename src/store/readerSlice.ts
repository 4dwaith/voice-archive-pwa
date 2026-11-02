import {
  createSelector,
  nanoid,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { resolvePageNumber } from '../components/atoms/ReaderProgressNavigation/resolvePageNumber'
import type {
  ReaderAnchor,
  ReaderScope,
  ReaderPageNavigationRequest,
  StoredReaderMeasurement,
  ReaderMeasurementSave,
  ReaderSegmentError,
  ReaderTocPresentation,
} from '../models/reader'

export type ReaderState = {
  viewMode: 'text' | 'pdf' | 'both'
  areControlsVisible: boolean
  layoutKey: string | null
  measurementSave: ReaderMeasurementSave | null
  tocNavigationError: string | null
  selectedSectionId: number | null
  sectionExpansion: Record<number, boolean>
  tocPresentation: ReaderTocPresentation

  pageScope: ReaderPageNavigationRequest['scope']

  scope: ReaderScope | null
  hasNavigated: boolean
  anchor: ReaderAnchor | null

  pageNavigationIntent: {
    requestId: string
    scope: ReaderPageNavigationRequest['scope']
    pageNumber: number
  } | null
  pageNavigationError: string | null

  selectedSegmentId: number | null
  highlightedSegmentId: number | null
  segmentErrors: Record<number, ReaderSegmentError>
}

const initialState: ReaderState = {
  viewMode: 'text',
  areControlsVisible: true,
  layoutKey: null,
  measurementSave: null,
  tocNavigationError: null,
  selectedSectionId: null,
  sectionExpansion: {},
  tocPresentation: 'shown',

  pageScope: 'local',

  scope: null,
  hasNavigated: false,
  anchor: null,

  pageNavigationIntent: null,
  pageNavigationError: null,

  selectedSegmentId: null,
  highlightedSegmentId: null,
  segmentErrors: {},
}

// The context adapter needs a stable predicate for IDs supplied by components.
const getSectionExpansionPredicateForState = createSelector(
  [(state: ReaderState) => state.sectionExpansion],
  (sectionExpansion) => (sectionId: number) =>
    sectionExpansion[sectionId] ?? true,
)

function hasMatchingScope(current: ReaderScope | null, expected: ReaderScope) {
  return (
    current?.bookId === expected.bookId &&
    current.contentVersion === expected.contentVersion
  )
}

const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
    setReaderViewMode(state, action: PayloadAction<ReaderState['viewMode']>) {
      state.viewMode = action.payload
    },
    setControlsVisible(state, action: PayloadAction<boolean>) {
      state.areControlsVisible = action.payload
    },
    reportLayoutKey(state, action: PayloadAction<string | null>) {
      if (state.layoutKey !== action.payload) {
        state.measurementSave = null
      }
      state.layoutKey = action.payload
    },
    // The listener persists this event; reports are not committed readiness.
    reportPageMeasurement(
      state,
      action: PayloadAction<StoredReaderMeasurement>,
    ) {
      const { bookId, contentVersion, chapterId, layoutKey } = action.payload
      state.measurementSave = {
        bookId,
        contentVersion,
        chapterId,
        layoutKey,
        outcome: null,
      }
    },
    recordMeasurementSave(state, action: PayloadAction<ReaderMeasurementSave>) {
      const target = state.measurementSave
      const result = action.payload
      if (
        target?.bookId === result.bookId &&
        target.contentVersion === result.contentVersion &&
        target.chapterId === result.chapterId &&
        target.layoutKey === result.layoutKey
      )
        state.measurementSave = action.payload
    },
    setPageScope(
      state,
      action: PayloadAction<ReaderPageNavigationRequest['scope']>,
    ) {
      if (state.pageScope !== action.payload) state.pageNavigationIntent = null
      state.pageScope = action.payload
    },
    requestPageNavigation: {
      prepare(
        request: ReaderPageNavigationRequest & {
          currentPage: number | null
          pageCount: number | null
        },
      ) {
        return { payload: { ...request, requestId: nanoid() } }
      },
      reducer(
        state,
        {
          payload,
        }: PayloadAction<
          ReaderPageNavigationRequest & {
            currentPage: number | null
            pageCount: number | null
            requestId: string
          }
        >,
      ) {
        if (!state.scope) return
        const previous = state.pageNavigationIntent
        const base =
          previous?.scope === payload.scope
            ? previous.pageNumber
            : payload.currentPage
        const pageNumber = resolvePageNumber(
          payload.kind === 'absolute'
            ? payload.pageNumber
            : base === null
              ? NaN
              : base + payload.delta,
          payload.pageCount,
        )
        if (pageNumber === null) return
        state.hasNavigated = true
        state.pageNavigationIntent = {
          requestId: payload.requestId,
          scope: payload.scope,
          pageNumber,
        }
        state.pageNavigationError = null
      },
    },
    completePageNavigation(
      state,
      action: PayloadAction<
        ReaderScope & {
          layoutKey: string
          requestId: string
          anchor: ReaderAnchor | null
          sectionId: number | null
        }
      >,
    ) {
      const result = action.payload
      if (
        !hasMatchingScope(state.scope, result) ||
        state.layoutKey !== result.layoutKey ||
        state.pageNavigationIntent?.requestId !== result.requestId
      )
        return
      if (result.anchor) {
        state.anchor = result.anchor
        state.selectedSectionId = result.sectionId
        state.tocNavigationError = null
      }
      state.pageNavigationError = result.anchor
        ? null
        : 'The page could not be opened. Try again when pages are ready.'
      state.pageNavigationIntent = null
    },
    selectSection(state, action: PayloadAction<number | null>) {
      state.hasNavigated = true
      state.selectedSectionId = action.payload
      state.tocNavigationError = null
      state.pageNavigationIntent = null
      state.pageNavigationError = null
    },
    reportTocNavigationError(state, action: PayloadAction<string>) {
      state.tocNavigationError = action.payload
    },
    setSectionExpanded(
      state,
      action: PayloadAction<{ sectionId: number; isExpanded: boolean }>,
    ) {
      state.sectionExpansion[action.payload.sectionId] =
        action.payload.isExpanded
    },
    setTocPresentation(state, action: PayloadAction<ReaderTocPresentation>) {
      state.tocPresentation = action.payload
    },
    openReader(state, action: PayloadAction<ReaderScope>) {
      state.selectedSegmentId = null
      state.highlightedSegmentId = null
      state.areControlsVisible = true
      state.selectedSectionId = null
      state.tocNavigationError = null
      state.hasNavigated = false
      state.scope = action.payload
      state.anchor = null
      state.layoutKey = null
      state.measurementSave = null
      state.pageNavigationIntent = null
      state.pageNavigationError = null
    },
    closeReader(state, action: PayloadAction<ReaderScope>) {
      if (!hasMatchingScope(state.scope, action.payload)) return
      state.selectedSegmentId = null
      state.highlightedSegmentId = null
      state.scope = null
      state.anchor = null
      state.layoutKey = null
      state.measurementSave = null
      state.pageNavigationIntent = null
      state.pageNavigationError = null
    },
    reconcileReaderAnchor(
      state,
      action: PayloadAction<
        ReaderScope & { hasContent: boolean; firstAnchor: ReaderAnchor | null }
      >,
    ) {
      if (!hasMatchingScope(state.scope, action.payload)) return
      if (!action.payload.hasContent) state.anchor = null
      else if (!state.hasNavigated) state.anchor ??= action.payload.firstAnchor
    },
    setReaderAnchor(
      state,
      action: PayloadAction<
        ReaderScope & { anchor: ReaderAnchor; sectionId?: number }
      >,
    ) {
      if (!hasMatchingScope(state.scope, action.payload)) return
      state.hasNavigated = true
      state.anchor = action.payload.anchor
      if (action.payload.sectionId !== undefined)
        state.selectedSectionId = action.payload.sectionId
      state.tocNavigationError = null
      state.pageNavigationIntent = null
      state.pageNavigationError = null
    },
    selectSegment(state, action: PayloadAction<number | null>) {
      state.selectedSegmentId = action.payload
    },
    highlightSegment(state, action: PayloadAction<number | null>) {
      state.highlightedSegmentId = action.payload
    },
    reportSegmentError(
      state,
      action: PayloadAction<{
        segmentId: number
        error: ReaderSegmentError | null
      }>,
    ) {
      const { segmentId, error } = action.payload
      if (error === null) delete state.segmentErrors[segmentId]
      else state.segmentErrors[segmentId] = error
    },
  },
  selectors: {
    getReaderViewMode: (state) => state.viewMode,
    getPageNavigationIntent: (state) => state.pageNavigationIntent,
    getPageNavigationError: (state) => state.pageNavigationError,
    getTocNavigationError: (state) => state.tocNavigationError,
    getAreControlsVisible: (state) => state.areControlsVisible,
    hasReaderNavigated: (state) => state.hasNavigated,
    getReaderAnchor: (state) => state.anchor,
    getReaderScope: (state) => state.scope,
    getLayoutKey: (state) => state.layoutKey,
    getMeasurementSave: (state) => state.measurementSave,
    getSelectedSectionId: (state) => state.selectedSectionId,
    isSectionExpanded: (state, sectionId: number) =>
      getSectionExpansionPredicateForState(state)(sectionId),
    getSectionExpansionPredicate: getSectionExpansionPredicateForState,
    getTocPresentation: (state) => state.tocPresentation,
    getPageScope: (state) => state.pageScope,
    isPageNavigationPending: (state) => state.pageNavigationIntent !== null,
    getSelectedSegmentId: (state) => state.selectedSegmentId,
    getHighlightedSegmentId: (state) => state.highlightedSegmentId,
  },
})

export const {
  setReaderViewMode,
  setControlsVisible,
  reportTocNavigationError,
  openReader,
  closeReader,
  reconcileReaderAnchor,
  setReaderAnchor,
  reportLayoutKey,
  reportPageMeasurement,
  recordMeasurementSave,
  setPageScope,
  requestPageNavigation,
  completePageNavigation,
  selectSection,
  setSectionExpanded,
  setTocPresentation,
  selectSegment,
  highlightSegment,
  reportSegmentError,
} = readerSlice.actions
export const {
  getReaderViewMode,
  hasReaderNavigated,
  getPageNavigationIntent,
  getPageNavigationError,
  getAreControlsVisible,
  getTocNavigationError,
  getReaderAnchor,
  getReaderScope,
  getLayoutKey,
  getMeasurementSave,
  getPageScope,
  isPageNavigationPending,
  getSelectedSectionId,
  isSectionExpanded,
  getSectionExpansionPredicate,
  getTocPresentation,
  getSelectedSegmentId,
  getHighlightedSegmentId,
} = readerSlice.selectors
export default readerSlice.reducer
