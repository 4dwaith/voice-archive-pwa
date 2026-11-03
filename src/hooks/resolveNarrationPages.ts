import type {
  ReaderAnchor,
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../models/reader'

export function resolveNarrationTargetId({
  selectedSegmentId,
  anchor,
  currentPage,
  segments,
  measurement,
}: {
  selectedSegmentId: number | null
  anchor: ReaderAnchor | null
  currentPage: number | null
  segments: ReaderSegment[]
  measurement: ReaderLayoutMeasurement | undefined
}) {
  return selectedSegmentId !== null &&
    resolveNarrationPages(selectedSegmentId, segments, measurement).includes(
      currentPage ?? -1,
    )
    ? selectedSegmentId
    : (anchor?.segmentId ?? null)
}

export function resolveNarrationPages(
  segmentId: number,
  segments: ReaderSegment[],
  measurement: ReaderLayoutMeasurement | undefined,
) {
  const index = segments.findIndex((segment) => segment.id === segmentId)
  if (index < 0 || measurement?.unmappableSegmentIds.includes(segmentId))
    return []
  return (
    measurement?.pages
      .filter((page) => {
        if (!page.start || !page.end) return false
        const start = segments.findIndex(
          (segment) => segment.id === page.start!.segmentId,
        )
        const end = segments.findIndex(
          (segment) => segment.id === page.end!.segmentId,
        )
        return (
          start >= 0 &&
          end >= 0 &&
          index >= start &&
          (index < end || (index === end && page.end.offset > 0))
        )
      })
      .map((page) => page.localPage) ?? []
  )
}
