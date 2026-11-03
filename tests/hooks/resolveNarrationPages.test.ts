import { describe, expect, it } from 'vitest'
import {
  resolveNarrationPages,
  resolveNarrationTargetId,
} from '../../src/hooks/resolveNarrationPages'
import { resolveNarrationOffset } from '../../src/components/molecules/ReaderControls/scrollNarration'
import { createMeasurement } from '../helpers/readerMeasurements'
import { readerBookSegment } from '../../src/mock-data/readerBook'

describe('Narration page overlap', () => {
  it('includes later fragments of a selected segment', () => {
    const measurement = createMeasurement()
    measurement.unmappableSegmentIds = []
    measurement.pages = [
      {
        localPage: 1,
        start: { segmentId: 1, sourceKey: 'a', offset: 0 },
        end: { segmentId: 1, sourceKey: 'a', offset: 5 },
      },
      {
        localPage: 2,
        start: { segmentId: 1, sourceKey: 'a', offset: 5 },
        end: { segmentId: 2, sourceKey: 'b', offset: 0 },
      },
      {
        localPage: 3,
        start: { segmentId: 2, sourceKey: 'b', offset: 0 },
        end: { segmentId: 2, sourceKey: 'b', offset: 5 },
      },
    ]
    const segments = [
      { ...readerBookSegment, id: 1 },
      { ...readerBookSegment, id: 2 },
    ]

    expect(resolveNarrationPages(1, segments, measurement)).toEqual([1, 2])
    expect(resolveNarrationPages(2, segments, measurement)).toEqual([3])
  })
})

describe('Narration startup target', () => {
  it.each([
    { selectedSegmentId: 1, currentPage: 1, expected: 1 },
    { selectedSegmentId: 1, currentPage: 2, expected: 3 },
    { selectedSegmentId: 2, currentPage: 1, expected: 3 },
    { selectedSegmentId: null, currentPage: 1, expected: 3 },
  ])(
    'uses target $expected for selection $selectedSegmentId on page $currentPage',
    ({ selectedSegmentId, currentPage, expected }) => {
      const measurement = createMeasurement()
      const segments = [1, 2].map((id) => ({ ...readerBookSegment, id }))

      const target = resolveNarrationTargetId({
        selectedSegmentId,
        currentPage,
        measurement,
        segments,
        anchor: { segmentId: 3, offset: 0 },
      })

      expect(target).toBe(expected)
    },
  )
})

describe('Narration text estimate', () => {
  it.each([
    [-1, 0],
    [0, 0],
    [0.5, 2],
    [1, 3],
    [2, 3],
  ])('maps progress %s to a Unicode offset', (progress, expected) => {
    expect(resolveNarrationOffset('a😀bc', progress)).toBe(expected)
  })
})
