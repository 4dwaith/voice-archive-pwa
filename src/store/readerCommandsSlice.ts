import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type { ReaderScope } from '../models/reader'

export type ReaderCommand =
  | { kind: 'goHome' | 'refreshLibrary' }
  | { kind: 'downloadBook'; bookId: number }
  | { kind: 'setTextSize'; percent: number }
  | { kind: 'setViewMode'; mode: 'text' | 'pdf' }
  | ({ kind: 'selectSegment'; segmentId: number | null } & ReaderScope)
  | { kind: 'moveTextPage'; direction: 'previous' | 'next' }

const readerCommandsSlice = createSlice({
  name: 'readerCommands',
  initialState: {
    error: null as { requestId: string; message: string } | null,
  },
  reducers: {
    requestReaderCommand: {
      prepare(command: ReaderCommand, requestId = nanoid()) {
        return { payload: { ...command, requestId } }
      },
      reducer(state) {
        state.error = null
      },
    },
    cancelReaderCommands() {},
    reportReaderCommandError(
      state,
      action: PayloadAction<{ requestId: string; message: string }>,
    ) {
      state.error = action.payload
    },
  },
  selectors: { getReaderCommandError: (state) => state.error },
})

export const {
  requestReaderCommand,
  reportReaderCommandError,
  cancelReaderCommands,
} = readerCommandsSlice.actions
export const { getReaderCommandError } = readerCommandsSlice.selectors
export default readerCommandsSlice.reducer
