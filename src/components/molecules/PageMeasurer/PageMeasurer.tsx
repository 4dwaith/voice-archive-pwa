import { useCallback, useState } from 'react'
import { useReaderContext } from '../../../contexts/ReaderContext'
import type {
  ReaderLayoutMeasurement,
  ReaderPageMeasurement,
  ReaderSegment,
} from '../../../models/reader'
import { ReaderChapterLayout } from '../../atoms/ReaderChapterLayout/ReaderChapterLayout'

export function PageMeasurer({
  chapterIds,
  chapterSegments,
  layoutId,
}: {
  chapterIds: string[]
  // Each supplied array is a complete chapter, in canonical segment order.
  chapterSegments: Record<string, ReaderSegment[] | undefined>
  layoutId: string
}) {
  const { reportPageMeasurement } = useReaderContext().navigation
  const { textSizePercent } = useReaderContext().reader
  const [completedMeasurements, setCompletedMeasurements] = useState<
    (ReaderPageMeasurement & { segments: ReaderSegment[] })[]
  >([])

  const measuringChapterId = chapterIds.find(
    (id) =>
      !completedMeasurements.some(
        (measurement) =>
          measurement.chapterId === id &&
          measurement.layoutId === layoutId &&
          measurement.textSizePercent === textSizePercent &&
          measurement.segments === chapterSegments[id],
      ),
  )
  const segments =
    measuringChapterId === undefined
      ? undefined
      : chapterSegments[measuringChapterId]

  const reportMeasurement = useCallback(
    (result: ReaderLayoutMeasurement) => {
      if (measuringChapterId === undefined || segments === undefined) return
      const measurement = { ...result, chapterId: measuringChapterId, layoutId }
      reportPageMeasurement(measurement)
      setCompletedMeasurements((previous) => [
        ...previous.filter(
          (completed) => completed.chapterId !== measuringChapterId,
        ),
        { ...measurement, segments },
      ])
    },
    [measuringChapterId, layoutId, segments, reportPageMeasurement],
  )

  // Missing data is not an empty chapter. Wait for an unmeasured chapter with segments.
  if (segments === undefined) return null

  return (
    <div
      className="invisible h-full min-h-0 w-full min-w-0 pointer-events-none"
      aria-hidden="true"
      inert
      data-reader-measurer
    >
      <ReaderChapterLayout
        key={JSON.stringify([measuringChapterId, layoutId])}
        segments={segments}
        page={1}
        textSizePercent={textSizePercent}
        shouldMeasure
        onPageMeasure={reportMeasurement}
      />
    </div>
  )
}
