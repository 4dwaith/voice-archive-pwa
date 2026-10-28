import { createSlice } from '@reduxjs/toolkit'

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

export const { decreaseTextSize, increaseTextSize } = textSizeSlice.actions
export const { selectTextSizePercent, selectTextSizeStep } =
  textSizeSlice.selectors
export default textSizeSlice.reducer
