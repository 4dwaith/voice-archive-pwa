import {
  createAction,
  createSlice,
  nanoid,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { openReader, closeReader } from './readerSlice'
import type { ReaderScope } from '../models/reader'
import type { ReaderAudioSnapshot } from '../models/readerAudio'

export type ReaderAudioPlayback = ReaderScope &
  (
    | { isPlaying: true; segmentId?: number }
    | { isPlaying: false; restartFromPage?: boolean }
  )

type PlaybackRequest = ReaderAudioPlayback & { requestId: string }

type AudioControllerScope = ReaderScope & { controllerId: string }
export type ReaderAudioObservation = AudioControllerScope &
  ReaderAudioSnapshot & { requestId: string | null }

// Relative seeks are events: each dispatch must execute, even in the same render.
export const seekReaderAudioBySeconds = createAction<
  ReaderScope & { seconds: number }
>('readerAudio/seekBySeconds')

const readerAudioSlice = createSlice({
  name: 'readerAudio',
  initialState: {
    playbackRequest: null as PlaybackRequest | null,
    observation: null as ReaderAudioObservation | null,
  },
  reducers: {
    registerReaderAudioController(
      state,
      { payload }: PayloadAction<ReaderAudioObservation>,
    ) {
      state.observation = payload
    },
    reportReaderAudio(
      state,
      { payload }: PayloadAction<ReaderAudioObservation>,
    ) {
      const current = state.observation
      const request = state.playbackRequest
      if (
        current?.controllerId !== payload.controllerId ||
        current.bookId !== payload.bookId ||
        current.contentVersion !== payload.contentVersion ||
        (request?.bookId === payload.bookId &&
          request.contentVersion === payload.contentVersion &&
          request.requestId !== payload.requestId)
      )
        return
      state.observation = payload
    },
    clearReaderAudioObservation(
      state,
      { payload }: PayloadAction<AudioControllerScope>,
    ) {
      if (
        state.observation?.controllerId === payload.controllerId &&
        state.observation.bookId === payload.bookId &&
        state.observation.contentVersion === payload.contentVersion
      )
        state.observation = null
    },
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
        state.observation = null
      })
      .addCase(closeReader, (state, { payload }) => {
        if (
          state.observation?.bookId === payload.bookId &&
          state.observation.contentVersion === payload.contentVersion
        )
          state.observation = null
        if (
          state.playbackRequest?.bookId === payload.bookId &&
          state.playbackRequest.contentVersion === payload.contentVersion
        )
          state.playbackRequest = null
      }),
  selectors: {
    getReaderAudioPlaybackRequest: (state) => state.playbackRequest,
    getReaderAudioObservation: (state) => state.observation,
  },
})

export const {
  setReaderAudioPlayback,
  registerReaderAudioController,
  reportReaderAudio,
  clearReaderAudioObservation,
} = readerAudioSlice.actions
export const { getReaderAudioPlaybackRequest, getReaderAudioObservation } =
  readerAudioSlice.selectors
export default readerAudioSlice.reducer
