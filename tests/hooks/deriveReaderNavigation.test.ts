import { describe, expect, it } from 'vitest'
import type { CachedSection } from '../../src/models/content'
import {
  deriveGlobalPage,
  deriveTocSections,
  locateChapter,
} from '../../src/hooks/deriveReaderNavigation'

const rootSection: Readonly<CachedSection> = {
  bookId: 7,
  version: 'version',
  id: 10,
  parent_id: null,
  sequence: 0,
  sibling_sequence: 0,
  source_key: 'root',
  title: 'Root',
  kind: 'chapter',
  audio_file_id: null,
  summary: null,
  first_segment_source_key: 'text',
}

describe('ToC sections', () => {
  it.each([
    [false, 1, 'text', 'Preparing pages', 'Preparing pages'],
    [true, 0, 'text', 'No readable pages', 'No readable pages'],
    [false, 0, null, 'No text target', 'Preparing pages'],
    [true, 1, 'text', undefined, undefined],
  ] as const)(
    'uses root readiness %s, count %i and target %s',
    (isReady, pageCount, sourceKey, reason, rootReason) => {
      const sections = [
        { ...rootSection },
        {
          ...rootSection,
          id: 5,
          parent_id: 10,
          first_segment_source_key: sourceKey,
        },
        {
          ...rootSection,
          id: 2,
          parent_id: 5,
          first_segment_source_key: sourceKey,
        },
      ]
      const chapterInfo = {
        sections,
        readyChapterIds: new Set(isReady ? ['10'] : []),
        countsByChapter: new Map([['10', pageCount]]),
        downloadedChapterRanges: new Map(),
      }

      const result = deriveTocSections(chapterInfo)

      expect(
        result.map((section) => [section.id, section.unavailableReason]),
      ).toEqual([
        [10, rootReason],
        [5, reason],
        [2, reason],
      ])
      expect(
        sections.every((section) => !('unavailableReason' in section)),
      ).toBe(true)
    },
  )

  it('prepends Before for leading text', () => {
    const chapterInfo = {
      sections: [{ ...rootSection }],
      readyChapterIds: new Set(['10']),
      countsByChapter: new Map([['10', 1]]),
      downloadedChapterRanges: new Map([
        [
          'before',
          { startSegmentSequenceNumber: 0, endSegmentSequenceNumber: 3 },
        ],
      ]),
    }

    const result = deriveTocSections(chapterInfo)

    expect(result[0]).toEqual({
      id: 0,
      parent_id: null,
      title: 'Before',
      sequence: -1,
      unavailableReason: 'Preparing pages',
    })
    expect(result[1]).toEqual({ ...rootSection, unavailableReason: undefined })
    expect(chapterInfo.sections).toEqual([rootSection])
  })

  it.each([
    undefined,
    { startSegmentSequenceNumber: 0, endSegmentSequenceNumber: 0 },
  ])('omits Before without leading text: %j', (range) => {
    const chapterInfo = {
      sections: [{ ...rootSection }],
      readyChapterIds: new Set(['10']),
      countsByChapter: new Map([['10', 1]]),
      downloadedChapterRanges: new Map(range ? [['before', range]] : []),
    }

    const result = deriveTocSections(chapterInfo)

    expect(result.map((section) => section.id)).toEqual([10])
  })

  it.each([null, undefined])(
    'returns no rows while data is %s',
    (chapterInfo) => {
      expect(deriveTocSections(chapterInfo)).toEqual([])
    },
  )
})

describe('Chapter lookup', () => {
  it.each([
    [-1, undefined],
    [0, 'before'],
    [2, 'before'],
    [3, '10'],
    [6, '10'],
    [7, undefined],
    [8, undefined],
    [9, '2'],
    [100, '2'],
  ])('locates sequence %i in %s', (sequence, expected) => {
    const chapterIds = ['before', '10', 'empty', 'missing', '2']
    const ranges = new Map([
      [
        'before',
        { startSegmentSequenceNumber: 0, endSegmentSequenceNumber: 3 },
      ],
      ['10', { startSegmentSequenceNumber: 3, endSegmentSequenceNumber: 7 }],
      ['empty', { startSegmentSequenceNumber: 7, endSegmentSequenceNumber: 7 }],
      [
        '2',
        { startSegmentSequenceNumber: 9, endSegmentSequenceNumber: Infinity },
      ],
    ])

    const result = locateChapter(sequence, chapterIds, ranges)

    expect(result).toBe(expected)
  })
})

describe('Global page numbering', () => {
  it.each([
    [1, 'before', 1],
    [2, '2', 7],
    [null, '2', null],
    [1, 'later', null],
    [1, undefined, null],
  ])('maps page %s in chapter %s to %s', (currentPage, chapterId, expected) => {
    const chapterInfo = {
      indexedChapterIds: ['before', '10', 'empty', '2'],
      countsByChapter: new Map([
        ['before', 2],
        ['10', 3],
        ['empty', 0],
        ['2', 4],
        ['later', 5],
      ]),
    }

    const result = deriveGlobalPage(currentPage, chapterId, chapterInfo)

    expect(result).toBe(expected)
  })

  it.each([null, undefined])(
    'stays unknown while data is %s',
    (chapterInfo) => {
      expect(deriveGlobalPage(1, '10', chapterInfo)).toBeNull()
    },
  )
})
