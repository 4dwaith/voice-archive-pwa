import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
} from '@reduxjs/toolkit'
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import textSizeReducer from './textSizeSlice'
import { readReaderPreferences } from '../data/readerPreferences'
import { createReaderPreferencesListener } from './readerPreferencesListener'
import bookDownloadsReducer from './bookDownloadsSlice'
import readerReducer from './readerSlice'
import readerSearchReducer from './readerSearchSlice'
import readerAudioReducer from './readerAudioSlice'
import readerCommandsReducer from './readerCommandsSlice'
import { createReaderCommandsListener } from './readerCommandsListener'
import liveReducer from './liveSlice'
import { createLiveListener } from './liveListener'
import { createBookDownloadsListener } from './bookDownloadsListener'
import { createReaderNavigationListener } from './readerNavigationListener'
import { createReaderTocListener } from './readerTocListener'
import { createReaderSearchListener } from './readerSearchListener'
import { createReaderMeasurementsListener } from './readerMeasurementsListener'
import { archiveApi } from '../api-client/archiveApi'

const rootReducer = combineReducers({
  textSize: textSizeReducer,
  bookDownloads: bookDownloadsReducer,
  reader: readerReducer,
  readerSearch: readerSearchReducer,
  readerAudio: readerAudioReducer,
  live: liveReducer,
  readerCommands: readerCommandsReducer,
  [archiveApi.reducerPath]: archiveApi.reducer,
})
export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = ThunkDispatch<RootState, undefined, UnknownAction>

// Each store owns its listener instances, including isolated integration tests.
export function createAppStore() {
  const readerAudioListener = createListenerMiddleware()
  const readerCommandsListener = createReaderCommandsListener()
  const liveListener = createLiveListener()
  const preferences = readReaderPreferences()
  const readerPreferencesListener = createReaderPreferencesListener(preferences)
  const bookDownloadsListener = createBookDownloadsListener()
  const readerMeasurementsListener = createReaderMeasurementsListener()
  const readerNavigationListener = createReaderNavigationListener()
  const readerTocListener = createReaderTocListener()
  const readerSearchListener = createReaderSearchListener()
  const appStore = configureStore({
    preloadedState: {
      textSize: { step: preferences.textSizeStep },
      reader: {
        ...readerReducer(undefined, { type: 'initialize' }),
        viewMode: preferences.viewMode ?? 'text',
      },
    },
    reducer: rootReducer,
    middleware: (defaults) =>
      defaults()
        .prepend(
          // Observe after the audio adapter's synchronous effects, especially Pause.
          readerCommandsListener.middleware,
          liveListener.middleware,
          readerAudioListener.middleware,
          readerPreferencesListener.middleware,
          bookDownloadsListener.middleware,
          readerTocListener.middleware,
          readerNavigationListener.middleware,
          readerSearchListener.middleware,
          readerMeasurementsListener.middleware,
        )
        .concat(archiveApi.middleware),
  })
  return Object.assign(appStore, {
    registerCommandNavigation: readerCommandsListener.registerNavigation,
  })
}
export const store = createAppStore()
export type AppStore = ReturnType<typeof createAppStore>
