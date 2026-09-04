import { configureStore } from '@reduxjs/toolkit'
import textSizeReducer from './textSizeSlice'

export const store = configureStore({
  reducer: {
    textSize: textSizeReducer,
  },
})

export type AppStore = typeof store
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
