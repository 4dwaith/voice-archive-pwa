import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type { ReaderScope } from '../models/reader'

export type ReaderDestination = ReaderScope &
  (
    | { target: 'current' }
    | { target: 'section'; sectionId: number }
    | { target: 'segment'; segmentId: number; offset?: number }
  )

export type ReaderCommand =
  | { kind: 'goHome' | 'refreshLibrary' }
  | { kind: 'downloadBook'; bookId: number }
  | { kind: 'setTextSize'; percent: number }
  | { kind: 'setViewMode'; mode: 'text' | 'pdf' }
  | ({ kind: 'selectSegment'; segmentId: number | null } & ReaderScope)
  | ({ kind: 'openBook' } & ReaderScope)
  | ({ kind: 'navigateToSection'; sectionId: number } & ReaderScope)
  | ({
      kind: 'navigateToSegment'
      segmentId: number
      offset?: number
    } & ReaderScope)
  | { kind: 'startPlayback'; destination: ReaderDestination }
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
    reportCommandRoute(_state, _action: PayloadAction<string>) {},
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
  reportCommandRoute,
} = readerCommandsSlice.actions
export const { getReaderCommandError } = readerCommandsSlice.selectors
export default readerCommandsSlice.reducer
