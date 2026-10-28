import { useCallback, useEffect, useRef, useState } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import type {
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../../../models/reader'
import { ReaderChapterLayout } from '../../atoms/ReaderChapterLayout/ReaderChapterLayout'

export function PageMeasurer({
  chapterIds,
  loadChapterSegments,
  layoutKey,
  bookId,
  contentVersion,
  readyChapterIds,
  availableChapterIds,
  retryKey = 0,
}: {
  bookId: number
  contentVersion: string
  chapterIds: string[]
  loadChapterSegments: (
    chapterId: string,
  ) => Promise<ReaderSegment[] | undefined>
  layoutKey: string | null
  readyChapterIds: ReadonlySet<string>
  availableChapterIds: ReadonlySet<string>
  // The caller exposes save failures and changes this only for deliberate retry.
  retryKey?: number
}) {
  const measuringChapterId = chapterIds.find((id) => !readyChapterIds.has(id))

  if (
    measuringChapterId === undefined ||
    !availableChapterIds.has(measuringChapterId) ||
    layoutKey === null
  )
    return null

  return (
    <LoadChapterToMeasure
      key={JSON.stringify([
        bookId,
        contentVersion,
        measuringChapterId,
        layoutKey,
        retryKey,
      ])}
      chapterId={measuringChapterId}
      loadChapterSegments={loadChapterSegments}
      layoutKey={layoutKey}
    />
  )
}

// The parent's key makes this component a lifecycle boundary for one load.
// Changing the target or retry unmounts it, releasing the previous segments and
// error state; effect cleanup prevents late responses from publishing into it.
function LoadChapterToMeasure({
  chapterId,
  layoutKey,
  loadChapterSegments,
}: {
  chapterId: string
  layoutKey: string
  loadChapterSegments: (
    chapterId: string,
  ) => Promise<ReaderSegment[] | undefined>
}) {
  const [segments, setSegments] = useState<ReaderSegment[]>()
  const [loadFailure, setLoadFailure] = useState<{ error: unknown }>()

  useEffect(
    function loadChapterForMeasurement() {
      let isCancelled = false

      async function loadRequestedChapter() {
        try {
          const loadedSegments = await loadChapterSegments(chapterId)

          if (!isCancelled) setSegments(loadedSegments)
        } catch (error) {
          if (!isCancelled) setLoadFailure({ error })
        }
      }

      void loadRequestedChapter()

      return () => {
        isCancelled = true
      }
    },
    [chapterId, loadChapterSegments],
  )

  if (loadFailure !== undefined) throw loadFailure.error
  if (segments === undefined) return null

  return (
    <MeasureChapter
      chapterId={chapterId}
      segments={segments}
      layoutKey={layoutKey}
    />
  )
}

function MeasureChapter({
  chapterId,
  segments,
  layoutKey,
}: {
  chapterId: string
  segments: ReaderSegment[]
  layoutKey: string
}) {
  const { reportPageMeasurement } = useReaderContext().navigation
  const { textSizePercent } = useReaderContext().reader
  const hasSubmitted = useRef(false)

  const reportChapterMeasurement = useCallback(
    (measurement: ReaderLayoutMeasurement) => {
      if (hasSubmitted.current || measurement.layoutKey !== layoutKey) return

      hasSubmitted.current = true
      reportPageMeasurement({ ...measurement, chapterId })
    },
    [chapterId, layoutKey, reportPageMeasurement],
  )

  return (
    <div
      className="invisible h-full min-h-0 w-full min-w-0 pointer-events-none"
      aria-hidden="true"
      inert
      data-reader-measurer
    >
      <ReaderChapterLayout
        segments={segments}
        page={1}
        textSizePercent={textSizePercent}
        shouldMeasure
        onPageMeasure={reportChapterMeasurement}
      />
    </div>
  )
}
