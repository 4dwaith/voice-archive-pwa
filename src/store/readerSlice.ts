import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'
import type {
  ReaderPageNavigation,
  ReaderPageMeasurement,
  ReaderMeasurementTarget,
  ReaderSegmentError,
  ReaderTocPresentation,
} from '../models/reader'

export type ReaderState = {
  measuredTargets: ReaderMeasurementTarget[]
  selectedSectionId: number | null
  sectionExpansion: Record<number, boolean>
  tocPresentation: ReaderTocPresentation

  pageScope: ReaderPageNavigation['scope']

  currentPage: number
  globalPage: number | null

  pageCount: number | null
  totalPageCount: number | null
  indexedPageCount: number

  pageNavigationIntent: ReaderPageNavigation | null

  selectedSegmentId: number | null
  highlightedSegmentId: number | null
  segmentErrors: Record<number, ReaderSegmentError>
}

const initialState: ReaderState = {
  measuredTargets: [],
  selectedSectionId: null,
  sectionExpansion: {},
  tocPresentation: 'shown',

  pageScope: 'local',

  currentPage: 1,
  globalPage: null,

  pageCount: null,
  totalPageCount: null,
  indexedPageCount: 0,

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

const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
    reportPageMeasurement(state, action: PayloadAction<ReaderPageMeasurement>) {
      const { chapterId, layoutId } = action.payload
      if (
        !state.measuredTargets.some(
          (target) =>
            target.chapterId === chapterId && target.layoutId === layoutId,
        )
      ) {
        state.measuredTargets.push({ chapterId, layoutId })
      }
    },
    setPageScope(state, action: PayloadAction<ReaderPageNavigation['scope']>) {
      state.pageScope = action.payload
    },
    requestPageNavigation(state, action: PayloadAction<ReaderPageNavigation>) {
      state.pageNavigationIntent = action.payload
    },
    selectSection(state, action: PayloadAction<number | null>) {
      state.selectedSectionId = action.payload
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
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload
    },
    reportPageCount(state, action: PayloadAction<number | null>) {
      state.pageCount = action.payload
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
    getSelectedSectionId: (state) => state.selectedSectionId,
    isSectionExpanded: (state, sectionId: number) =>
      getSectionExpansionPredicateForState(state)(sectionId),
    getSectionExpansionPredicate: getSectionExpansionPredicateForState,
    getTocPresentation: (state) => state.tocPresentation,
    getCurrentPage: (state) => state.currentPage,
    getPageCount: (state) => state.pageCount,
    getPageScope: (state) => state.pageScope,
    getGlobalPage: (state) => state.globalPage,
    getTotalPageCount: (state) => state.totalPageCount,
    getIndexedPageCount: (state) => state.indexedPageCount,
    isPageNavigationPending: (state) => state.pageNavigationIntent !== null,
    getSelectedSegmentId: (state) => state.selectedSegmentId,
    getHighlightedSegmentId: (state) => state.highlightedSegmentId,
  },
})

export const {
  reportPageMeasurement,
  setPageScope,
  requestPageNavigation,
  selectSection,
  setSectionExpanded,
  setTocPresentation,
  setCurrentPage,
  reportPageCount,
  selectSegment,
  highlightSegment,
  reportSegmentError,
} = readerSlice.actions
export const {
  getPageScope,
  getGlobalPage,
  getTotalPageCount,
  getIndexedPageCount,
  isPageNavigationPending,
  getSelectedSectionId,
  isSectionExpanded,
  getSectionExpansionPredicate,
  getTocPresentation,
  getCurrentPage,
  getPageCount,
  getSelectedSegmentId,
  getHighlightedSegmentId,
} = readerSlice.selectors
export default readerSlice.reducer
