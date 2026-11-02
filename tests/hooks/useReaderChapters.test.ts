// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { database } from '../../src/data/database'
import { createMeasurement, seedContent } from '../helpers/readerMeasurements'
import { useReaderChapters } from '../../src/hooks/useReaderChapters'
import { readChapterSegments } from '../../src/data/readerChapterRepository'
import { saveChapterMeasurement } from '../../src/data/measurementRepository'

beforeEach(async () => {
  await database.delete()
  await database.open()
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await database.delete()
})

describe('live reader chapters', () => {
  it('withholds partial inputs and inherits ownership across committed batches', async () => {
    await seedContent()
    const root = (await database.sections.toArray())[0]
    const segment = (await database.segments.toArray())[0]
    await database.sections.bulkPut([
      { ...root, id: 99, sequence: 1, parent_id: 10 },
      { ...root, id: 5, sequence: 2, first_segment_source_key: null },
      { ...root, id: 3, sequence: 3, first_segment_source_key: 'next' },
    ])
    await database.segments.clear()
    await database.content.update(7, {
      complete: false,
      'manifest.section_count': 4,
      'manifest.segment_count': 4,
      progress: {
        sectionNextOffset: null,
        segmentNextOffset: 0,
        lastSegmentSequence: null,
      },
    })
    const { result } = renderHook(() =>
      useReaderChapters(7, 'version', 'layout'),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.chapters?.downloadedChapterRanges.has('10')).toBe(
      false,
    )
    expect(await saveChapterMeasurement(createMeasurement())).toBe('rejected')

    await act(async () => {
      await database.transaction(
        'rw',
        database.segments,
        database.content,
        async () => {
          await database.segments.bulkPut([
            {
              ...segment,
              id: 8,
              sequence: 0,
              source_key: 'intro',
              section_id: null,
              root_section_id: null,
            },
            { ...segment, sequence: 4, section_id: 99 },
          ])
          await database.content.update(7, {
            'progress.segmentNextOffset': 2,
            'progress.lastSegmentSequence': 4,
          })
        },
      )
    })
    await waitFor(() =>
      expect(
        result.current.chapters?.downloadedChapterRanges.get('before'),
      ).toEqual({
        startSegmentSequenceNumber: 0,
        endSegmentSequenceNumber: 4,
      }),
    )

    expect(result.current.chapters?.downloadedChapterRanges.has('10')).toBe(
      false,
    )

    await act(async () => {
      await database.transaction(
        'rw',
        database.segments,
        database.content,
        async () => {
          await database.segments.bulkPut([
            {
              ...segment,
              id: 6,
              sequence: 9,
              source_key: 'inherited',
              section_id: null,
              root_section_id: null,
            },
            {
              ...segment,
              id: 4,
              sequence: 15,
              source_key: 'next',
              section_id: 3,
              root_section_id: 3,
            },
          ])
          await database.content.update(7, {
            'progress.segmentNextOffset': 4,
            'progress.lastSegmentSequence': 15,
          })
        },
      )
    })
    await waitFor(() =>
      expect(
        result.current.chapters?.downloadedChapterRanges.get('10'),
      ).toEqual({
        startSegmentSequenceNumber: 4,
        endSegmentSequenceNumber: 15,
      }),
    )

    expect(result.current.chapters?.chapterIds).toEqual([
      'before',
      '10',
      '5',
      '3',
    ])
    expect(await readChapterSegments(7, 'version', '5')).toEqual([])
    expect(
      (await readChapterSegments(7, 'version', '10'))?.map((row) => row.id),
    ).toEqual([1, 6])
    expect(result.current.chapters?.downloadedChapterRanges.has('3')).toBe(
      false,
    )
    expect(result.current.chapters?.totalPageCount).toBeNull()
    expect(
      (await database.segments.get([7, 'version', 9]))?.section_id,
    ).toBeNull()
    expect(await saveChapterMeasurement(createMeasurement())).toBe('saved')

    await act(async () => {
      await database.content.update(7, { 'progress.segmentNextOffset': null })
    })
    await waitFor(() =>
      expect(result.current.chapters?.downloadedChapterRanges.get('3')).toEqual(
        {
          startSegmentSequenceNumber: 15,
          endSegmentSequenceNumber: Infinity,
        },
      ),
    )
  })

  it('reads payloads only for the requested chapter range', async () => {
    await seedContent()
    const root = (await database.sections.toArray())[0]
    const segment = (await database.segments.toArray())[0]
    await database.sections.put({
      ...root,
      id: 20,
      sequence: 1,
      first_segment_source_key: 'later',
    })
    await database.segments.put({
      ...segment,
      id: 3,
      sequence: 90,
      source_key: 'later',
      section_id: 20,
      root_section_id: 20,
    })
    await database.content.update(7, {
      'manifest.section_count': 2,
      'manifest.segment_count': 3,
    })
    const readSegment = vi.fn((row: typeof segment) => row)
    database.segments.hook('reading', readSegment)

    try {
      const metadata = renderHook(() =>
        useReaderChapters(7, 'version', 'layout'),
      )
      await waitFor(() => expect(metadata.result.current.isLoading).toBe(false))
      await saveChapterMeasurement(createMeasurement())

      expect(readSegment).not.toHaveBeenCalled()
      expect(metadata.result.current.chapters).not.toHaveProperty(
        'chapterSegments',
      )

      const chapterSegments = await readChapterSegments(7, 'version', '10')

      expect(chapterSegments?.map((row) => row.id)).toEqual([1, 2])
      expect(readSegment.mock.calls.map(([row]) => row.id)).toEqual([1, 2])

      const beforeSegments = await readChapterSegments(7, 'version', 'before')

      expect(beforeSegments).toEqual([])
      expect(readSegment).toHaveBeenCalledTimes(2)
      expect(await readChapterSegments(7, 'version', 'missing')).toBeUndefined()
    } finally {
      database.segments.hook('reading').unsubscribe(readSegment)
    }
  })

  it('derives only the contiguous committed prefix, including zero pages', async () => {
    await seedContent()
    const { result } = renderHook(() =>
      useReaderChapters(7, 'version', 'layout'),
    )
    await waitFor(() =>
      expect(result.current.chapters?.chapterIds).toEqual(['before', '10']),
    )

    await act(async () => {
      await saveChapterMeasurement(createMeasurement())
    })
    await waitFor(() =>
      expect(result.current.chapters?.readyChapterIds.has('10')).toBe(true),
    )

    expect(result.current.chapters?.indexedPageCount).toBe(0)
    expect(result.current.chapters?.totalPageCount).toBeNull()

    await act(async () => {
      await saveChapterMeasurement({
        ...createMeasurement(),
        chapterId: 'before',
        pages: [],
      })
    })
    await waitFor(() => expect(result.current.chapters?.totalPageCount).toBe(1))

    expect(result.current.chapters?.countsByChapter.get('before')).toBe(0)
    expect(result.current.chapters?.indexedChapterIds).toEqual(['before', '10'])
  })

  it.each([
    { bookId: 8, contentVersion: 'version', layoutKey: 'layout' },
    { bookId: 7, contentVersion: 'new', layoutKey: 'layout' },
    { bookId: 7, contentVersion: 'version', layoutKey: 'new' },
  ])('immediately invalidates a changed identity %o', async (identity) => {
    await seedContent()
    await saveChapterMeasurement(createMeasurement())
    const initial = {
      bookId: 7,
      contentVersion: 'version',
      layoutKey: 'layout',
    }
    const { result, rerender } = renderHook(
      ({ bookId, contentVersion, layoutKey }) =>
        useReaderChapters(bookId, contentVersion, layoutKey),
      { initialProps: initial },
    )
    await waitFor(() =>
      expect(result.current.chapters?.readyChapterIds.has('10')).toBe(true),
    )

    rerender(identity)

    expect(result.current).toEqual({ isLoading: true, chapters: undefined })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.chapters?.readyChapterIds.has('10') ?? false).toBe(
      false,
    )
  })
})
