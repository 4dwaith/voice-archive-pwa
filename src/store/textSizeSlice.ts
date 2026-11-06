import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export const MIN_TEXT_SIZE_STEP = 0
export const MAX_TEXT_SIZE_STEP = 32
export const TEXT_SIZE_BASE = 100
export const TEXT_SIZE_INCREMENT = 12.5

export const getTextSizePercent = (step: number) =>
  TEXT_SIZE_BASE + step * TEXT_SIZE_INCREMENT

type TextSizeState = {
  step: number
}

const initialState: TextSizeState = {
  step: 0,
}

const textSizeSlice = createSlice({
  name: 'textSize',
  initialState,
  reducers: {
    setTextSizePercent(state, action: PayloadAction<number>) {
      const step = (action.payload - TEXT_SIZE_BASE) / TEXT_SIZE_INCREMENT
      if (
        Number.isInteger(step) &&
        step >= MIN_TEXT_SIZE_STEP &&
        step <= MAX_TEXT_SIZE_STEP
      )
        state.step = step
    },
    decreaseTextSize(state) {
      state.step = Math.max(MIN_TEXT_SIZE_STEP, state.step - 1)
    },
    increaseTextSize(state) {
      state.step = Math.min(MAX_TEXT_SIZE_STEP, state.step + 1)
    },
  },
  selectors: {
    selectTextSizeStep: (state) => state.step,
    selectTextSizePercent: (state) => getTextSizePercent(state.step),
  },
})

export const { decreaseTextSize, increaseTextSize, setTextSizePercent } =
  textSizeSlice.actions
export const { selectTextSizePercent, selectTextSizeStep } =
  textSizeSlice.selectors
export default textSizeSlice.reducer
