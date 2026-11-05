import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
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
import type { AppDispatch, RootState } from './store'

export function createLiveListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  let conversation: ReturnType<typeof createLiveConversation> | null = null

  listener.startListening({
    matcher: isAnyOf(initializeLiveSession, requestLiveSession),
    effect(action, api) {
      if (!conversation) {
        conversation = createLiveConversation()
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
      } else if (action.payload.kind === 'discard') conversation.discard()
      else conversation.stop()
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

  return listener
}
