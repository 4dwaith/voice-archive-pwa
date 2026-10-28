import type {
  ReaderAnchor,
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../models/reader'
import { getGraphemeBoundaries } from '../components/atoms/ReaderChapterLayout/getGraphemeBoundaries'

export function resolveAnchorPage(
  anchor: ReaderAnchor | null,
  segments: ReaderSegment[],
  measurement: ReaderLayoutMeasurement | undefined,
) {
  if (
    !anchor ||
    !measurement ||
    measurement.unmappableSegmentIds.includes(anchor.segmentId)
  )
    return null

  // Canonical offsets count code points, but an anchor must also fall between
  // graphemes so it cannot split a combining sequence or joined character.
  const index = segments.findIndex((segment) => segment.id === anchor.segmentId)
  if (
    index < 0 ||
    !getGraphemeBoundaries(segments[index].text_content).some(
      (boundary) => boundary.codePoint === anchor.offset,
    )
  )
    return null

  // Compare the anchor with a page boundary: negative means before it, zero
  // means equal, positive means after it. Null means the boundary is unknown.
  function comparePosition(
    position: NonNullable<ReaderLayoutMeasurement['pages'][number]['start']>,
  ) {
    const positionIndex = segments.findIndex(
      (segment) =>
        segment.id === position.segmentId &&
        segment.source_key === position.sourceKey,
    )
    // Array order is document order; numeric segment IDs do not imply order.
    // For different segments, their index difference decides the comparison.
    // Only equal indexes produce zero and let || compare code-point offsets.
    return positionIndex < 0
      ? null
      : index - positionIndex || anchor!.offset - position.offset
  }

  for (const page of measurement.pages) {
    if (!page.start || !page.end) continue
    const start = comparePosition(page.start)
    const end = comparePosition(page.end)
    // Pages include their start and exclude their end, so an anchor exactly
    // at a shared boundary belongs to the following page.
    if (start !== null && end !== null && start >= 0 && end < 0)
      return page.localPage
  }
  return null
}
