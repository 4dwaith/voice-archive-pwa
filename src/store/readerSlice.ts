import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ReaderSegmentError } from '../models/reader'

export type ReaderState = {
  selectedSegmentId: number | null
  highlightedSegmentId: number | null
  segmentErrors: Record<number, ReaderSegmentError>
}

const initialState: ReaderState = {
  selectedSegmentId: null,
  highlightedSegmentId: null,
  segmentErrors: {},
}

const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
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
    selectSelectedSegmentId: (state) => state.selectedSegmentId,
    selectHighlightedSegmentId: (state) => state.highlightedSegmentId,
  },
})

export const { selectSegment, highlightSegment, reportSegmentError } =
  readerSlice.actions
export const { selectSelectedSegmentId, selectHighlightedSegmentId } =
  readerSlice.selectors
export default readerSlice.reducer
