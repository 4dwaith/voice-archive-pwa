import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'
import type {
  ReaderAnchor,
  ReaderScope,
  ReaderPageNavigation,
  StoredReaderMeasurement,
  ReaderMeasurementSave,
  ReaderSegmentError,
  ReaderTocPresentation,
} from '../models/reader'

export type ReaderState = {
  areControlsVisible: boolean
  layoutKey: string | null
  measurementSave: ReaderMeasurementSave | null
  tocNavigationError: string | null
  selectedSectionId: number | null
  sectionExpansion: Record<number, boolean>
  tocPresentation: ReaderTocPresentation

  pageScope: ReaderPageNavigation['scope']

  scope: ReaderScope | null
  anchor: ReaderAnchor | null

  pageNavigationIntent: ReaderPageNavigation | null

  selectedSegmentId: number | null
  highlightedSegmentId: number | null
  segmentErrors: Record<number, ReaderSegmentError>
}

const initialState: ReaderState = {
  areControlsVisible: true,
  layoutKey: null,
  measurementSave: null,
  tocNavigationError: null,
  selectedSectionId: null,
  sectionExpansion: {},
  tocPresentation: 'shown',

  pageScope: 'local',

  scope: null,
  anchor: null,

  pageNavigationIntent: null,

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
    setPageScope(state, action: PayloadAction<ReaderPageNavigation['scope']>) {
      state.pageScope = action.payload
    },
    requestPageNavigation(state, action: PayloadAction<ReaderPageNavigation>) {
      state.pageNavigationIntent = action.payload
    },
    selectSection(state, action: PayloadAction<number | null>) {
      state.selectedSectionId = action.payload
      state.tocNavigationError = null
      state.pageNavigationIntent = null
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
      state.areControlsVisible = true
      state.selectedSectionId = null
      state.tocNavigationError = null
      state.scope = action.payload
      state.anchor = null
      state.layoutKey = null
      state.measurementSave = null
      state.pageNavigationIntent = null
    },
    closeReader(state, action: PayloadAction<ReaderScope>) {
      if (!hasMatchingScope(state.scope, action.payload)) return
      state.scope = null
      state.anchor = null
      state.layoutKey = null
      state.measurementSave = null
      state.pageNavigationIntent = null
    },
    reconcileReaderAnchor(
      state,
      action: PayloadAction<
        ReaderScope & { hasContent: boolean; firstAnchor: ReaderAnchor | null }
      >,
    ) {
      if (!hasMatchingScope(state.scope, action.payload)) return
      if (!action.payload.hasContent) state.anchor = null
      else state.anchor ??= action.payload.firstAnchor
    },
    setReaderAnchor(
      state,
      action: PayloadAction<ReaderScope & { anchor: ReaderAnchor }>,
    ) {
      if (!hasMatchingScope(state.scope, action.payload)) return
      state.anchor = action.payload.anchor
      state.tocNavigationError = null
      state.pageNavigationIntent = null
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
    getTocNavigationError: (state) => state.tocNavigationError,
    getAreControlsVisible: (state) => state.areControlsVisible,
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
  selectSection,
  setSectionExpanded,
  setTocPresentation,
  selectSegment,
  highlightSegment,
  reportSegmentError,
} = readerSlice.actions
export const {
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
