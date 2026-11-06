import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export const MAX_PLAYBACK_SPEED_STEP = 25
export const DEFAULT_PLAYBACK_SPEED_STEP = 5
// Integer steps keep every 0.05 increment exact.
export const getPlaybackSpeed = (step: number) => (75 + step * 5) / 100

export function isPlaybackSpeed(rate: number) {
  const step = Math.round((rate * 100 - 75) / 5)
  return (
    step >= 0 &&
    step <= MAX_PLAYBACK_SPEED_STEP &&
    getPlaybackSpeed(step) === rate
  )
}

const playbackSpeedSlice = createSlice({
  name: 'playbackSpeed',
  initialState: { step: DEFAULT_PLAYBACK_SPEED_STEP },
  reducers: {
    setPlaybackSpeed(state, action: PayloadAction<number>) {
      if (isPlaybackSpeed(action.payload))
        state.step = Math.round((action.payload * 100 - 75) / 5)
    },
    adjustPlaybackSpeed(state, action: PayloadAction<-1 | 1>) {
      state.step = Math.max(
        0,
        Math.min(MAX_PLAYBACK_SPEED_STEP, state.step + action.payload),
      )
    },
  },
  selectors: {
    selectPlaybackSpeed: (state) => getPlaybackSpeed(state.step),
    selectPlaybackSpeedStep: (state) => state.step,
  },
})

export const { setPlaybackSpeed, adjustPlaybackSpeed } =
  playbackSpeedSlice.actions
export const { selectPlaybackSpeed, selectPlaybackSpeedStep } =
  playbackSpeedSlice.selectors
export default playbackSpeedSlice.reducer
