import { describe, expect, it } from 'vitest'
import readerReducer, {
  reportPageMeasurement,
} from '../../src/store/readerSlice'
import type { ReaderPageMeasurement } from '../../src/models/reader'

function createMeasurement(
  chapterId = 'chapter',
  layoutId = 'layout',
): ReaderPageMeasurement {
  return {
    chapterId,
    layoutId,
    width: 320,
    height: 212,
    textSizePercent: 100,
    pages: [
      {
        localPage: 1,
        start: { segmentId: 1, sourceKey: 'segment', offset: 0 },
        end: { segmentId: 1, sourceKey: 'segment', offset: 3 },
      },
    ],
    unmappableSegmentIds: [],
  }
}

describe('reader measurement targets', () => {
  it('records each reported target once without storing geometry', () => {
    const measurement = createMeasurement()
    const initial = readerReducer(undefined, reportPageMeasurement(measurement))

    const state = readerReducer(initial, reportPageMeasurement(measurement))

    expect(state.measuredTargets).toEqual([
      { chapterId: 'chapter', layoutId: 'layout' },
    ])
  })

  it.each([
    ['another-chapter', 'layout'],
    ['chapter', 'another-layout'],
  ])('retains the distinct target %s / %s', (chapterId, layoutId) => {
    const initial = readerReducer(
      undefined,
      reportPageMeasurement(createMeasurement()),
    )
    const measurement = createMeasurement(chapterId, layoutId)

    const state = readerReducer(initial, reportPageMeasurement(measurement))

    expect(state.measuredTargets).toEqual([
      { chapterId: 'chapter', layoutId: 'layout' },
      { chapterId, layoutId },
    ])
  })
})
