import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { createContentTransport } from '../api-client/resources/contentApi'
import { deleteLocalContent } from '../data/contentRepository'
import {
  synchronizeBookContent,
  isBookMissing,
} from '../services/synchronizeBookContent'
import type { RootState, AppDispatch } from './store'
import {
  requestBookLoad,
  requestBookRetry,
  requestBookRemoval,
  recordBookRequestStart,
  recordBookRequestSuccess,
  recordBookRequestFailure,
  recordBookRequestCompletion,
} from './bookDownloadsSlice'

export function createBookDownloadsListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  const isBookRequest = isAnyOf(
    requestBookLoad,
    requestBookRetry,
    requestBookRemoval,
  )
  listener.startListening({
    matcher: isBookRequest,
    effect: async (action, api) => {
      const request = action.payload
      const getDownload = () =>
        api.getState().bookDownloads.byBook[request.bookId]

      if (getDownload()?.requestId !== request.requestId) return

      // Close/remove/reopen waits until the previous operation's actual writes settle.
      if (getDownload()?.activeRequestId) {
        await api.condition((_, state) => {
          const entry = state.bookDownloads.byBook[request.bookId]
          return (
            !entry?.activeRequestId || entry.requestId !== request.requestId
          )
        })
      }
      if (getDownload()?.requestId !== request.requestId) return
      api.dispatch(recordBookRequestStart(request))

      const controller = new AbortController()
      const abort = () => controller.abort()
      api.signal.addEventListener('abort', abort, { once: true })
      const cancellation = api.fork(async ({ pause }) => {
        if (getDownload()?.requestId !== request.requestId) {
          controller.abort()
          return
        }
        await pause(
          api.condition(
            (_, state) =>
              state.bookDownloads.byBook[request.bookId]?.requestId !==
              request.requestId,
          ),
        )
        controller.abort()
      })

      try {
        if (requestBookRemoval.match(action)) {
          await deleteLocalContent(request.bookId)
          controller.signal.throwIfAborted()
          api.dispatch(
            recordBookRequestSuccess({
              ...request,
              status: 'idle',
              manifest: null,
            }),
          )
        } else {
          await synchronizeBookContent(
            request,
            createContentTransport(api.dispatch),
            api.dispatch,
            controller.signal,
          )
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          api.dispatch(
            recordBookRequestFailure({
              ...request,
              error: isBookMissing(error)
                ? 'This book is no longer available.'
                : 'This book couldn’t be loaded. Please try again.',
            }),
          )
        }
      } finally {
        cancellation.cancel()
        api.signal.removeEventListener('abort', abort)
        api.dispatch(recordBookRequestCompletion(request))
      }
    },
  })
  return listener
}
