import { describe, expect, it } from 'vitest'
import {
  resolveAnchorPage,
  resolvePageSectionSelection,
} from '../../../src/hooks/resolveAnchorPage'
import type {
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../../../src/models/reader'

const segments: ReaderSegment[] = [90, 2].map((id) => ({
  id,
  source_key: String(id),
  kind: 'prose',
  html_content: '<p>A\u{1f600}e\u0301Z</p>',
  text_content: 'A\u{1f600}e\u0301Z',
  language: null,
}))

function createPosition(index: number, offset: number) {
  return {
    segmentId: segments[index].id,
    sourceKey: segments[index].source_key,
    offset,
  }
}

const measurement: ReaderLayoutMeasurement = {
  layoutKey: 'key',
  width: 320,
  height: 200,
  textSizePercent: 100,
  pages: [
    { localPage: 1, start: createPosition(0, 0), end: createPosition(0, 2) },
    { localPage: 2, start: createPosition(0, 2), end: createPosition(1, 2) },
    { localPage: 3, start: createPosition(1, 2), end: createPosition(1, 5) },
  ],
  unmappableSegmentIds: [],
}

describe('Anchor page resolution', () => {
  it.each([
    [90, 0, 1],
    [90, 1, 1],
    [90, 2, 2],
    [90, 4, 2],
    [2, 0, 2],
    [2, 2, 3],
    [90, 3, null],
    [2, 5, null],
    [2, -1, null],
    [2, 6, null],
    [400, 0, null],
  ])('resolves segment %s offset %s to %s', (segmentId, offset, expected) => {
    expect(
      resolveAnchorPage({ segmentId, offset }, segments, measurement),
    ).toBe(expected)
  })

  it('keeps an unmappable segment unknown', () => {
    const report = { ...measurement, unmappableSegmentIds: [90] }

    expect(
      resolveAnchorPage({ segmentId: 90, offset: 0 }, segments, report),
    ).toBeNull()
  })

  it('waits for matching measurements', () => {
    expect(
      resolveAnchorPage({ segmentId: 90, offset: 0 }, segments, undefined),
    ).toBeNull()
  })

  it('does not resolve a missing endpoint by numeric ID order', () => {
    const report = {
      ...measurement,
      pages: [
        {
          ...measurement.pages[0],
          end: { segmentId: 3, sourceKey: 'absent', offset: 0 },
        },
      ],
    }

    expect(
      resolveAnchorPage({ segmentId: 90, offset: 0 }, segments, report),
    ).toBeNull()
  })
})

describe('Page section selection', () => {
  const sections = [
    { id: 10, parent_id: null },
    { id: 20, parent_id: 10 },
    { id: 30, parent_id: 20 },
  ]
  const segments = [
    { id: 1, section_id: 10 },
    { id: 2, section_id: 30 },
    { id: 3, section_id: null },
  ]

  it.each([20, 30])(
    'preserves selected section %i while inside it',
    (selected) => {
      const sectionId = resolvePageSectionSelection(
        { segmentId: 2, offset: 0 },
        segments,
        sections,
        selected,
        10,
      )

      expect(sectionId).toBe(selected)
    },
  )

  it('selects the current root after leaving a nested section', () => {
    const sectionId = resolvePageSectionSelection(
      { segmentId: 1, offset: 0 },
      segments,
      sections,
      20,
      10,
    )

    expect(sectionId).toBe(10)
  })

  it('keeps inherited ownership for unsectioned text', () => {
    const sectionId = resolvePageSectionSelection(
      { segmentId: 3, offset: 0 },
      segments,
      sections,
      20,
      10,
    )

    expect(sectionId).toBe(20)
  })

  it('selects Before after leaving a section for leading text', () => {
    const sectionId = resolvePageSectionSelection(
      { segmentId: 4, offset: 0 },
      [{ id: 4, section_id: null }],
      sections,
      20,
      0,
    )

    expect(sectionId).toBe(0)
  })
})
