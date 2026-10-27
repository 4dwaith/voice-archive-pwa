import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ReaderSegmentError } from '../models/reader'

export type ReaderState = {
  currentPage: number
  pageCount: number | null
  selectedSegmentId: number | null
  highlightedSegmentId: number | null
  segmentErrors: Record<number, ReaderSegmentError>
}

const initialState: ReaderState = {
  currentPage: 1,
  pageCount: null,
  selectedSegmentId: null,
  highlightedSegmentId: null,
  segmentErrors: {},
}

const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
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
    selectCurrentPage: (state) => state.currentPage,
    selectPageCount: (state) => state.pageCount,
    selectSelectedSegmentId: (state) => state.selectedSegmentId,
    selectHighlightedSegmentId: (state) => state.highlightedSegmentId,
  },
})

export const {
  setCurrentPage,
  reportPageCount,
  selectSegment,
  highlightSegment,
  reportSegmentError,
} = readerSlice.actions
export const {
  selectCurrentPage,
  selectPageCount,
  selectSelectedSegmentId,
  selectHighlightedSegmentId,
} = readerSlice.selectors
export default readerSlice.reducer
