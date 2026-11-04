import {
  createAction,
  createSlice,
  nanoid,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { openReader, closeReader } from './readerSlice'
import type { ReaderScope } from '../models/reader'

export type ReaderAudioPlayback = ReaderScope &
  (
    | { isPlaying: true; segmentId?: number }
    | { isPlaying: false; restartFromPage?: boolean }
  )

type PlaybackRequest = ReaderAudioPlayback & { requestId: string }

// Relative seeks are events: each dispatch must execute, even in the same render.
export const seekReaderAudioBySeconds = createAction<
  ReaderScope & { seconds: number }
>('readerAudio/seekBySeconds')

const readerAudioSlice = createSlice({
  name: 'readerAudio',
  initialState: { playbackRequest: null as PlaybackRequest | null },
  reducers: {
    setReaderAudioPlayback: {
      prepare(playback: ReaderAudioPlayback) {
        return { payload: { ...playback, requestId: nanoid() } }
      },
      reducer(state, action: PayloadAction<PlaybackRequest>) {
        state.playbackRequest = action.payload
      },
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(openReader, (state) => {
        state.playbackRequest = null
      })
      .addCase(closeReader, (state, { payload }) => {
        if (
          state.playbackRequest?.bookId === payload.bookId &&
          state.playbackRequest.contentVersion === payload.contentVersion
        )
          state.playbackRequest = null
      }),
  selectors: {
    getReaderAudioPlaybackRequest: (state) => state.playbackRequest,
  },
})

export const { setReaderAudioPlayback } = readerAudioSlice.actions
export const { getReaderAudioPlaybackRequest } = readerAudioSlice.selectors
export default readerAudioSlice.reducer
