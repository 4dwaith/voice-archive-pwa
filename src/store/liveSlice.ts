import { createAction, createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type LiveReport = {
  status: 'idle' | 'connecting' | 'connected' | 'failed'
  error: string | null
  canContinue: boolean
}

type LiveState = LiveReport & {
  requestedActivity: 'start' | 'stop' | 'discard'
  handoff: { requestId: string; controllerId: string } | null
}

const initialState: LiveState = {
  requestedActivity: 'stop',
  status: 'idle',
  error: null,
  canContinue: false,
  handoff: null,
}

// Read continuation metadata without starting capture.
export const initializeLiveSession = createAction('live/initializeSession')

const liveSlice = createSlice({
  name: 'live',
  initialState,
  reducers: {
    requestLiveSession(
      state,
      { payload }: PayloadAction<{ kind: 'start' | 'stop' | 'discard' }>,
    ) {
      state.requestedActivity = payload.kind
      state.handoff = null
    },
    reportLiveSession(state, { payload }: PayloadAction<LiveReport>) {
      Object.assign(state, payload)
      if (payload.status !== 'connected') state.handoff = null
    },
    quiesceLiveForPlayback(
      state,
      { payload }: PayloadAction<{ requestId: string; controllerId: string }>,
    ) {
      if (state.status === 'connected') state.handoff = payload
    },
    clearLiveHandoff(state) {
      state.handoff = null
    },
  },
  selectors: { getLiveSession: (state) => state },
})

export const {
  requestLiveSession,
  reportLiveSession,
  quiesceLiveForPlayback,
  clearLiveHandoff,
} = liveSlice.actions
export const { getLiveSession } = liveSlice.selectors
export default liveSlice.reducer
