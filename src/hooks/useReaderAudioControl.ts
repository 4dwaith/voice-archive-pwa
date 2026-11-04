import { useEffect, useRef } from 'react'
import {
  addListener,
  removeListener,
  isAnyOf,
  type UnknownAction,
} from '@reduxjs/toolkit'
import { useAppDispatch, useAppSelector, useAppStore } from '../store/hooks'
import {
  getReaderAnchor,
  getReaderScope,
  getSelectedSegmentId,
  selectSegment,
} from '../store/readerSlice'
import {
  getReaderAudioPlaybackRequest,
  setReaderAudioPlayback,
  seekReaderAudioBySeconds,
} from '../store/readerAudioSlice'
import type { createReaderAudioController } from '../services/readerAudioController'
import type { ReaderScope } from '../models/reader'

type Player = Pick<
  ReturnType<typeof createReaderAudioController>,
  | 'getSnapshot'
  | 'playFromSegment'
  | 'pausePlayback'
  | 'seekBySeconds'
  | 'selectSegment'
>

export function useReaderAudioControl(
  player: Player | null,
  bookId: number | undefined,
  contentVersion: string | undefined,
  targetId: number | null,
  isNavigationPending: boolean,
) {
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const playbackRequest = useAppSelector(getReaderAudioPlaybackRequest)
  const applied = useRef<{ player: Player; requestId: string } | null>(null)

  useEffect(() => {
    if (!player) return
    const connectedPlayer = player

    function hasMatchingScope(scope: ReaderScope | null) {
      return (
        scope !== null &&
        scope.bookId === bookId &&
        scope.contentVersion === contentVersion
      )
    }

    function applyPlayback(request: NonNullable<typeof playbackRequest>) {
      if (
        !hasMatchingScope(getReaderScope(store.getState())) ||
        !hasMatchingScope(request)
      )
        return

      const snapshot = connectedPlayer.getSnapshot()
      if (
        applied.current?.player === player &&
        applied.current.requestId === request.requestId &&
        !(request.isPlaying && snapshot.status === 'idle')
      )
        return

      const segmentId = request.isPlaying
        ? (request.segmentId ?? targetId)
        : null

      if (
        request.isPlaying &&
        (segmentId === null ||
          (request.segmentId === undefined && isNavigationPending))
      )
        return

      applied.current = {
        player: connectedPlayer,
        requestId: request.requestId,
      }
      const anchor = getReaderAnchor(store.getState())

      if (!request.isPlaying) {
        connectedPlayer.pausePlayback(anchor, request.restartFromPage)
        if (request.restartFromPage) dispatch(selectSegment(null))
      } else if (request.segmentId !== undefined) {
        if (getSelectedSegmentId(store.getState()) !== request.segmentId)
          dispatch(selectSegment(request.segmentId))
        connectedPlayer.playFromSegment(request.segmentId)
      } else if (!snapshot.isPlaying)
        connectedPlayer.playFromSegment(segmentId!, anchor)
    }

    function handleAudioAction(action: UnknownAction) {
      if (!hasMatchingScope(getReaderScope(store.getState()))) return

      if (setReaderAudioPlayback.match(action)) applyPlayback(action.payload)
      else if (selectSegment.match(action))
        connectedPlayer.selectSegment(action.payload)
      else if (
        seekReaderAudioBySeconds.match(action) &&
        hasMatchingScope(action.payload)
      )
        void connectedPlayer.seekBySeconds(action.payload.seconds)
    }

    const options = {
      matcher: isAnyOf(
        setReaderAudioPlayback,
        seekReaderAudioBySeconds,
        selectSegment,
      ),
      effect: handleAudioAction,
    }
    // Pauses and relative seeks execute synchronously, before subsequent navigation.
    dispatch(addListener(options))

    const request = getReaderAudioPlaybackRequest(store.getState())
    if (request) applyPlayback(request)

    return () => {
      dispatch(removeListener(options))
    }
  }, [
    store,
    dispatch,
    player,
    bookId,
    contentVersion,
    targetId,
    isNavigationPending,
    playbackRequest,
  ])
}
