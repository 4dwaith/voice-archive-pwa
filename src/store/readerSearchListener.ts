import { createListenerMiddleware } from '@reduxjs/toolkit'
import { searchBookText } from '../data/searchBookText'
import {
  submitReaderSearch,
  isSearchPending,
  recordSearchSuccess,
  recordSearchFailure,
} from './readerSearchSlice'
import type { RootState, AppDispatch } from './store'

export function createReaderSearchListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  listener.startListening({
    actionCreator: submitReaderSearch,
    effect: async ({ payload }, api) => {
      if (!isSearchPending(api.getState(), payload)) return

      try {
        const results = await searchBookText(payload.scope, payload.query)
        api.dispatch(recordSearchSuccess({ ...payload, results }))
      } catch (error) {
        console.warn('Reader search failed.', error)
        api.dispatch(recordSearchFailure(payload))
      }
    },
  })
  return listener
}
