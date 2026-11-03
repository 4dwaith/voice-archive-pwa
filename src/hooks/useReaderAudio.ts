import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../data/database'
import { readFileNarration, readNarrationTarget } from '../data/readerNarration'
import {
  createReaderAudioController,
  idleReaderAudioSnapshot,
} from '../services/readerAudioController'
import { useAppDispatch } from '../store/hooks'
import { selectSegment, setReaderAnchor } from '../store/readerSlice'
import type { ReaderAnchor } from '../models/reader'

const subscribeToNothing = () => () => {}
const readIdleSnapshot = () => idleReaderAudioSnapshot

export function useReaderAudio(
  bookId: number | undefined,
  contentVersion: string | undefined,
  {
    targetId,
    anchor,
    isNavigationPending,
  }: {
    targetId: number | null
    anchor: ReaderAnchor | null
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

  const playback = useSyncExternalStore(
    player?.subscribe ?? subscribeToNothing,
    player?.getSnapshot ?? readIdleSnapshot,
  )
  const pausePlayback = useCallback(
    ({ restartFromPage = false } = {}) => {
      player?.pausePlayback(anchor, restartFromPage)
      if (restartFromPage) dispatch(selectSegment(null))
    },
    [anchor, player, dispatch],
  )
  const togglePlayback = useCallback(() => {
    if (playback.isPlaying) {
      pausePlayback()
      return
    }
    if (targetId === null || isNavigationPending) return
    player?.playFromSegment(targetId, anchor)
  }, [playback, targetId, anchor, pausePlayback, isNavigationPending, player])

  const selectAudioSegment = useCallback(
    (segmentId: number | null) => {
      player?.selectSegment(segmentId)
    },
    [player],
  )

  const seekBySeconds = useCallback(
    (seconds: number) => {
      void player?.seekBySeconds(seconds)
    },
    [player],
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
    selectAudioSegment,
    value,
  }
}
