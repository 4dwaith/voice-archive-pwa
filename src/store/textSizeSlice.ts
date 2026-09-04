import { createSlice } from '@reduxjs/toolkit'

export const textSizeSteps = [100, 112.5, 125, 137.5] as const

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
      state.step = Math.max(0, state.step - 1)
    },
    increaseTextSize(state) {
      state.step = Math.min(textSizeSteps.length - 1, state.step + 1)
    },
  },
  selectors: {
    selectTextSizeStep: (state) => state.step,
    selectTextSizePercent: (state) => textSizeSteps[state.step],
  },
})

export const { decreaseTextSize, increaseTextSize } = textSizeSlice.actions
export const { selectTextSizePercent, selectTextSizeStep } =
  textSizeSlice.selectors
export default textSizeSlice.reducer
