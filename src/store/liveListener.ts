import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { createLiveQueries } from '../services/liveQueries'
import { createLiveTools } from '../services/liveTools'
import { createLiveCommands } from '../services/liveCommands'
import { createLiveConversation } from '../services/liveConversation'
import { closeReader, getReaderScope, openReader } from './readerSlice'
import {
  clearReaderAudioObservation,
  getReaderAudioObservation,
  getReaderAudioPlaybackRequest,
  registerReaderAudioController,
  reportReaderAudio,
  setReaderAudioPlayback,
} from './readerAudioSlice'
import {
  clearLiveHandoff,
  getLiveSession,
  initializeLiveSession,
  quiesceLiveForPlayback,
  reportLiveSession,
  requestLiveSession,
} from './liveSlice'
import {
  reportReaderCommandError,
  getReaderCommandError,
  cancelReaderCommands,
} from './readerCommandsSlice'
import { completePageNavigation, getPageNavigationError } from './readerSlice'
import {
  recordBookRequestFailure,
  selectBookDownloadState,
} from './bookDownloadsSlice'
import type { AppDispatch, RootState } from './store'
import { getCurrentUser } from './authSlice'
import { getPreferredLanguage } from './userPreferencesSlice'

export function createLiveListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  let conversation: ReturnType<typeof createLiveConversation> | null = null

  listener.startListening({
    matcher: isAnyOf(initializeLiveSession, requestLiveSession),
    effect(action, api) {
      const isStopping =
        requestLiveSession.match(action) && action.payload.kind !== 'start'
      if (!getCurrentUser(api.getState()) && !isStopping) return
      if (!conversation && isStopping) return
      if (!conversation) {
        const commands = createLiveCommands(api.dispatch)
        conversation = createLiveConversation(
          undefined,
          createLiveTools(
            createLiveQueries(api.getState, api.dispatch),
            commands.endLiveSession,
            commands.request,
            commands.cancel,
          ),
          () => getPreferredLanguage(api.getState()),
        )
        const connectedConversation = conversation
        function publish() {
          api.dispatch(reportLiveSession(connectedConversation.getSnapshot()))
        }
        conversation.subscribe(publish)
        publish()
      }
      if (!requestLiveSession.match(action)) return

      if (action.payload.kind === 'start') {
        const scope = getReaderScope(api.getState())
        if (scope)
          api.dispatch(setReaderAudioPlayback({ ...scope, isPlaying: false }))
        // Keep activation on the explicit dispatch's user-gesture call stack.
        void conversation.start()
      } else {
        api.dispatch(cancelReaderCommands())
        if (action.payload.kind === 'discard') conversation.discard()
        else conversation.stop()
      }
    },
  })

  listener.startListening({
    matcher: isAnyOf(
      quiesceLiveForPlayback,
      setReaderAudioPlayback,
      reportReaderAudio,
      registerReaderAudioController,
      clearReaderAudioObservation,
      openReader,
      closeReader,
    ),
    effect(action, api) {
      if (!conversation) return
      if (quiesceLiveForPlayback.match(action)) {
        const live = getLiveSession(api.getState())
        if (live.status === 'connecting')
          api.dispatch(requestLiveSession({ kind: 'stop' }))
        else if (live.handoff) conversation.quiesceAudio()
      }
      const state = api.getState()
      const handoff = getLiveSession(state).handoff
      if (!handoff) return
      const request = getReaderAudioPlaybackRequest(state)
      const report = getReaderAudioObservation(state)
      if (report?.controllerId !== handoff.controllerId) {
        api.dispatch(requestLiveSession({ kind: 'stop' }))
      } else if (request?.requestId !== handoff.requestId) {
        api.dispatch(clearLiveHandoff())
        conversation.resumeAudio()
      } else if (report.requestId === handoff.requestId) {
        if (report.status === 'playing')
          api.dispatch(requestLiveSession({ kind: 'stop' }))
        else if (report.error) {
          api.dispatch(clearLiveHandoff())
          conversation.resumeAudio(report.error)
        }
      }
    },
  })

  listener.startListening({
    matcher: isAnyOf(
      reportReaderCommandError,
      completePageNavigation,
      recordBookRequestFailure,
    ),
    effect(action, api) {
      if (getLiveSession(api.getState()).status !== 'connected') return
      const error = reportReaderCommandError.match(action)
        ? action.payload.message
        : recordBookRequestFailure.match(action)
          ? action.payload.error
          : getPageNavigationError(api.getState())
      const previous = api.getOriginalState()
      if (
        recordBookRequestFailure.match(action) &&
        selectBookDownloadState(previous, action.payload.bookId) ===
          selectBookDownloadState(api.getState(), action.payload.bookId)
      )
        return
      if (
        reportReaderCommandError.match(action) &&
        getReaderCommandError(previous)?.requestId === action.payload.requestId
      )
        return
      if (
        completePageNavigation.match(action) &&
        getPageNavigationError(previous) === error
      )
        return
      if (error) conversation?.sendCommandError(error)
    },
  })

  return listener
}
