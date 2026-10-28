import { combineReducers, configureStore } from '@reduxjs/toolkit'
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import textSizeReducer from './textSizeSlice'
import bookDownloadsReducer from './bookDownloadsSlice'
import readerReducer from './readerSlice'
import { createBookDownloadsListener } from './bookDownloadsListener'
import { createReaderMeasurementsListener } from './readerMeasurementsListener'
import { archiveApi } from '../api-client/archiveApi'

const rootReducer = combineReducers({
  textSize: textSizeReducer,
  bookDownloads: bookDownloadsReducer,
  reader: readerReducer,
  [archiveApi.reducerPath]: archiveApi.reducer,
})
export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = ThunkDispatch<RootState, undefined, UnknownAction>

// Each store owns its listener instances, including isolated integration tests.
export function createAppStore() {
  const bookDownloadsListener = createBookDownloadsListener()
  const readerMeasurementsListener = createReaderMeasurementsListener()
  return configureStore({
    reducer: rootReducer,
    middleware: (defaults) =>
      defaults()
        .prepend(
          bookDownloadsListener.middleware,
          readerMeasurementsListener.middleware,
        )
        .concat(archiveApi.middleware),
  })
}
export const store = createAppStore()
export type AppStore = ReturnType<typeof createAppStore>
