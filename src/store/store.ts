import { configureStore } from '@reduxjs/toolkit'
import textSizeReducer from './textSizeSlice'
import { archiveApi } from '../api-client/archiveApi'

export const store = configureStore({
  reducer: {
    textSize: textSizeReducer,
    [archiveApi.reducerPath]: archiveApi.reducer,
  },
  middleware: (defaults) => defaults().concat(archiveApi.middleware),
})

export type AppStore = typeof store
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
