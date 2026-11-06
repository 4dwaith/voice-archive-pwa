import type { CachedSegment, CachedSection } from '../models/content'
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

export function resolvePageStart(
  pageNumber: number,
  segments: ReaderSegment[],
  measurement: ReaderLayoutMeasurement | undefined,
) {
  const start = measurement?.pages.find(
    (page) => page.localPage === pageNumber,
  )?.start
  return start && resolveAnchorPage(start, segments, measurement) === pageNumber
    ? { segmentId: start.segmentId, offset: start.offset }
    : null
}

export function clipPageText(
  segments: ReaderSegment[],
  page: ReaderLayoutMeasurement['pages'][number],
  unmappableIds: number[],
) {
  const startIndex = segments.findIndex(
    (segment) =>
      segment.id === page.start?.segmentId &&
      segment.source_key === page.start.sourceKey,
  )
  const endIndex = segments.findIndex(
    (segment) =>
      segment.id === page.end?.segmentId &&
      segment.source_key === page.end.sourceKey,
  )
  if (startIndex < 0 || endIndex < startIndex) return null

  const fragments = []
  for (const segment of segments.slice(startIndex, endIndex + 1)) {
    const points = Array.from(segment.text_content)
    const start = segment.id === page.start!.segmentId ? page.start!.offset : 0
    const end =
      segment.id === page.end!.segmentId ? page.end!.offset : points.length
    if (start === end) continue
    const boundaries = getGraphemeBoundaries(segment.text_content)
    if (
      unmappableIds.includes(segment.id) ||
      start > end ||
      ![start, end].every((offset) =>
        boundaries.some((boundary) => boundary.codePoint === offset),
      )
    )
      return null
    fragments.push({
      segmentId: segment.id,
      sourceKey: segment.source_key,
      start,
      end,
      text: points.slice(start, end).join(''),
    })
  }
  return fragments.length ? fragments : null
}

export function resolvePageSectionSelection(
  anchor: ReaderAnchor,
  segments: Pick<CachedSegment, 'id' | 'section_id'>[],
  sections: Pick<CachedSection, 'id' | 'parent_id'>[],
  selectedSectionId: number | null,
  rootSectionId: number,
) {
  const index = segments.findIndex((segment) => segment.id === anchor.segmentId)

  // Start from the anchor segment and walk backwards through the segments to find the first section ID.
  let sectionId =
    segments
      .slice(0, index + 1)
      .findLast((segment) => segment.section_id !== null)?.section_id ?? null

  while (sectionId !== null) {
    if (sectionId === selectedSectionId) return selectedSectionId
    sectionId =
      sections.find((section) => section.id === sectionId)?.parent_id ?? null
  }
  return rootSectionId
}
