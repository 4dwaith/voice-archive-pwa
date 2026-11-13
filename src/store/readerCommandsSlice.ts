import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type { PreferredLanguage } from './userPreferencesSlice'

export type ReaderDestination = { bookId: number; contentVersion?: string } & (
  | { target: 'current' }
  | { target: 'section'; sectionId: number }
  | { target: 'segment'; segmentId: number; offset?: number }
)

export type ReaderCommand =
  | { kind: 'goHome' | 'refreshLibrary' }
  | {
      kind: 'updateReaderSettings'
      preferredLanguage?: PreferredLanguage
      textSize?: number
      playbackSpeed?: number
      controlsVisible?: boolean
      viewMode?: 'text' | 'pdf'
    }
  | {
      kind: 'selectSegment'
      bookId: number
      segmentId: number | null
      contentVersion?: string
    }
  | { kind: 'openBook'; bookId: number; contentVersion?: string }
  | {
      kind: 'navigateToSection'
      bookId: number
      sectionId: number
      contentVersion?: string
    }
  | {
      kind: 'navigateToSegment'
      bookId: number
      segmentId: number
      offset?: number
      contentVersion?: string
    }
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
