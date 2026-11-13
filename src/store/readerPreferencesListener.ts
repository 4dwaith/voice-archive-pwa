import { createListenerMiddleware } from '@reduxjs/toolkit'
import { database } from '../data/database'
import {
  writeReaderPreferences,
  type ReaderPreferences,
} from '../data/readerPreferences'
import type { ReaderAnchor } from '../models/reader'
import {
  getReaderAnchor,
  reportLayoutKey,
  getReaderScope,
  getReaderViewMode,
} from './readerSlice'
import { selectTextSizeStep } from './textSizeSlice'
import { getPreferredLanguage } from './userPreferencesSlice'
import { selectPlaybackSpeedStep } from './playbackSpeedSlice'
import type { AppDispatch, RootState } from './store'

export function createReaderPreferencesListener(
  preferences: ReaderPreferences,
) {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  const pendingSaves = new Map<number, ReaderAnchor>()

  listener.startListening({
    predicate: (_action, current, previous) =>
      getPreferredLanguage(current) !== getPreferredLanguage(previous) ||
      getReaderViewMode(current) !== getReaderViewMode(previous) ||
      selectTextSizeStep(current) !== selectTextSizeStep(previous) ||
      selectPlaybackSpeedStep(current) !== selectPlaybackSpeedStep(previous) ||
      getReaderAnchor(current) !== getReaderAnchor(previous),
    effect: async (_action, api) => {
      const state = api.getState()
      const previous = api.getOriginalState()
      if (getPreferredLanguage(state) !== getPreferredLanguage(previous)) {
        preferences.preferredLanguage = getPreferredLanguage(state)
        writeReaderPreferences(preferences)
      }
      if (getReaderViewMode(state) !== getReaderViewMode(previous)) {
        preferences.viewMode = getReaderViewMode(state)
        writeReaderPreferences(preferences)
      }
      const step = selectTextSizeStep(state)
      if (step !== selectTextSizeStep(previous)) {
        api.dispatch(reportLayoutKey(null))
        preferences.textSizeStep = step
        writeReaderPreferences(preferences)
      }

      const speedStep = selectPlaybackSpeedStep(state)
      if (speedStep !== selectPlaybackSpeedStep(previous)) {
        preferences.playbackSpeedStep = speedStep
        writeReaderPreferences(preferences)
      }

      const anchor = getReaderAnchor(state)
      const scope = getReaderScope(state)
      if (!anchor || !scope || anchor === getReaderAnchor(previous)) return

      // Resolve numeric IDs in the captured dataset; only the latest book save wins.
      pendingSaves.set(scope.bookId, anchor)
      try {
        const segment = await database.segments
          .where('[bookId+version+id]')
          .equals([scope.bookId, scope.contentVersion, anchor.segmentId])
          .first()
        if (!segment || pendingSaves.get(scope.bookId) !== anchor) return

        preferences.positions[scope.bookId] = {
          version: scope.contentVersion,
          sourceKey: segment.source_key,
          offset: anchor.offset,
        }
        writeReaderPreferences(preferences)
      } catch (error) {
        console.warn('The reading position could not be saved.', error)
        // A cache read failure must not interrupt reading.
      }
    },
  })

  return listener
}
