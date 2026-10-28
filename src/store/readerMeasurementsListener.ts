import { createListenerMiddleware } from '@reduxjs/toolkit'
import { saveChapterMeasurement } from '../data/measurementRepository'
import { recordMeasurementSave, reportPageMeasurement } from './readerSlice'
import type { AppDispatch, RootState } from './store'

export function createReaderMeasurementsListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()

  listener.startListening({
    actionCreator: reportPageMeasurement,
    effect: async ({ payload }, api) => {
      let outcome: 'saved' | 'rejected' | 'failed'

      try {
        outcome = await saveChapterMeasurement(payload)
      } catch {
        outcome = 'failed'
      }

      const { bookId, contentVersion, chapterId, layoutKey } = payload

      api.dispatch(
        recordMeasurementSave({
          bookId,
          contentVersion,
          chapterId,
          layoutKey,
          outcome,
        }),
      )
    },
  })

  return listener
}
