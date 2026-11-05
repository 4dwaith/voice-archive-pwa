import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../data/database'
import { readFileNarration, readNarrationTarget } from '../data/readerNarration'
import {
  createReaderAudioController,
  idleReaderAudioSnapshot,
} from '../services/readerAudioController'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setReaderAnchor } from '../store/readerSlice'
import {
  setReaderAudioPlayback,
  seekReaderAudioBySeconds,
  getReaderAudioObservation,
} from '../store/readerAudioSlice'
import { useReaderAudioControl } from './useReaderAudioControl'

export function useReaderAudio(
  bookId: number | undefined,
  contentVersion: string | undefined,
  {
    targetId,
    isNavigationPending,
  }: {
    targetId: number | null
    isNavigationPending: boolean
  },
) {
  const dispatch = useAppDispatch()
  const [element, setElement] = useState<HTMLAudioElement | null>(null)
  const content = useLiveQuery(async () => {
    if (bookId === undefined || !contentVersion) return undefined
    const cached = await database.content.get(bookId)
    const count = await database.segments
      .where('[bookId+version]')
      .equals([bookId, contentVersion])
      .count()
    return {
      isAvailable: cached?.version === contentVersion,
      complete: cached?.complete,
      count,
    }
  }, [bookId, contentVersion])

  const player = useMemo(() => {
    if (
      bookId === undefined ||
      !contentVersion ||
      !content?.isAvailable ||
      !element
    )
      return null
    const scope = { bookId, contentVersion }
    return createReaderAudioController(element, {
      readTarget: (request, signal) =>
        readNarrationTarget(scope, request, signal),
      readFileSegments: (rootId, signal) =>
        readFileNarration(scope, rootId, signal),
      follow: (segment) => {
        dispatch(
          setReaderAnchor({
            ...scope,
            anchor: { segmentId: segment.id, offset: 0 },
            sectionId: segment.section_id ?? segment.root_section_id ?? 0,
          }),
        )
      },
    })
  }, [bookId, contentVersion, content?.isAvailable, element, dispatch])

  useEffect(() => {
    player?.connect()
    return () => player?.dispose()
  }, [player])

  useEffect(() => {
    void player?.refreshContent()
  }, [player, content?.count, content?.complete])

  const observation = useAppSelector(getReaderAudioObservation)
  const playback =
    observation &&
    observation.bookId === bookId &&
    observation.contentVersion === contentVersion
      ? observation
      : idleReaderAudioSnapshot

  useReaderAudioControl(
    player,
    bookId,
    contentVersion,
    targetId,
    isNavigationPending,
  )
  const pausePlayback = useCallback(
    ({ restartFromPage = false } = {}) => {
      if (bookId !== undefined && contentVersion)
        dispatch(
          setReaderAudioPlayback({
            bookId,
            contentVersion,
            isPlaying: false,
            restartFromPage,
          }),
        )
    },
    [bookId, contentVersion, dispatch],
  )
  const togglePlayback = useCallback(() => {
    if (player?.getSnapshot().isPlaying) {
      pausePlayback()
      return
    }
    if (targetId === null || isNavigationPending) return
    if (bookId !== undefined && contentVersion)
      dispatch(
        setReaderAudioPlayback({ bookId, contentVersion, isPlaying: true }),
      )
  }, [
    targetId,
    pausePlayback,
    isNavigationPending,
    player,
    bookId,
    contentVersion,
    dispatch,
  ])

  const seekBySeconds = useCallback(
    (seconds: number) => {
      if (bookId !== undefined && contentVersion)
        dispatch(seekReaderAudioBySeconds({ bookId, contentVersion, seconds }))
    },
    [bookId, contentVersion, dispatch],
  )
  const readProgress = useCallback(() => player?.readProgress() ?? 0, [player])
  const canPlay = player !== null && targetId !== null && !isNavigationPending
  const value = useMemo(
    () => ({
      ...playback,
      canPlay,
      togglePlayback,
      pausePlayback,
      seekBySeconds,
      readProgress,
    }),
    [
      playback,
      canPlay,
      togglePlayback,
      pausePlayback,
      seekBySeconds,
      readProgress,
    ],
  )

  return {
    highlightedSegmentId: playback.speakingSegmentId,
    elementRef: setElement,
    value,
  }
}
