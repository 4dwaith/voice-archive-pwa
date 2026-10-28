// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { database } from '../../src/data/database'
import { useReaderChapters } from '../../src/hooks/useReaderChapters'
import { readChapterSegments } from '../../src/data/readerChapterRepository'
import {
  deleteLocalContent,
  initializeContentStaging,
} from '../../src/data/contentRepository'
import { saveChapterMeasurement } from '../../src/data/measurementRepository'
import { createAppStore } from '../../src/store/store'
import {
  reportLayoutKey,
  reportPageMeasurement,
} from '../../src/store/readerSlice'
import type {
  ReaderMeasurementSave,
  StoredReaderMeasurement,
} from '../../src/models/reader'
import type { CachedContent } from '../../src/models/content'

function createMeasurement(): StoredReaderMeasurement {
  return {
    bookId: 7,
    contentVersion: 'version',
    chapterId: '10',
    layoutKey: 'layout',
    width: 320,
    height: 212,
    textSizePercent: 100,
    pages: [
      {
        localPage: 1,
        start: { segmentId: 1, sourceKey: 'text', offset: 0 },
        end: { segmentId: 1, sourceKey: 'text', offset: 3 },
      },
    ],
    unmappableSegmentIds: [2],
  }
}

async function seedContent() {
  const content: CachedContent = {
    bookId: 7,
    version: 'version',
    complete: true,
    manifest: {
      state: 'published',
      content_version: 'version',
      schema_version: 1,
      imported_at: '2026-10-28T00:00:00Z',
      source_pdf_file_id: null,
      section_count: 1,
      segment_count: 2,
      files: [],
    },
  }
  await database.content.put(content)
  await database.sections.put({
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
    first_segment_source_key: 'text',
  })
  await database.segments.bulkPut(
    [1, 2].map((id) => ({
      bookId: 7,
      version: 'version',
      id,
      sequence: id * 3,
      source_key: id === 1 ? 'text' : 'unmappable',
      section_id: 10,
      root_section_id: 10,
      kind: 'prose' as const,
      html_content: '<p>abc</p>',
      text_content: id === 1 ? 'abc' : 'invalid',
      language: null,
      regions: [],
      page_indexes: [],
      narration_start_ms: null,
      narration_end_ms: null,
      narration_seek_ms: null,
      alignment_status: null,
      alignment_metadata: null,
    })),
  )
  return content
}

function pauseMeasurementWrite() {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const put = database.measurements.put.bind(database.measurements)
  const write = vi
    .spyOn(database.measurements, 'put')
    .mockImplementationOnce((record) =>
      Dexie.Promise.resolve(Dexie.waitFor(pending)).then(() => put(record)),
    )
  return { release, write }
}

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

    expect(result.current.chapters?.downloadedChapterRanges.has('10')).toBe(false)
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
      expect(result.current.chapters?.downloadedChapterRanges.get('before')).toEqual({
        start: 0,
        end: 4,
      }),
    )

    expect(result.current.chapters?.downloadedChapterRanges.has('10')).toBe(false)

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
      expect(result.current.chapters?.downloadedChapterRanges.get('10')).toEqual({
        start: 4,
        end: 15,
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
    expect(result.current.chapters?.downloadedChapterRanges.has('3')).toBe(false)
    expect(result.current.chapters?.totalPageCount).toBeNull()
    expect(
      (await database.segments.get([7, 'version', 9]))?.section_id,
    ).toBeNull()
    expect(await saveChapterMeasurement(createMeasurement())).toBe('saved')

    await act(async () => {
      await database.content.update(7, { 'progress.segmentNextOffset': null })
    })
    await waitFor(() =>
      expect(result.current.chapters?.downloadedChapterRanges.get('3')).toEqual({
        start: 15,
        end: Infinity,
      }),
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

describe('chapter measurement commits', () => {
  it('stores the captured identity and boundaries through the listener', async () => {
    await seedContent()
    const store = createAppStore()
    const report = createMeasurement()
    const { release, write } = pauseMeasurementWrite()
    const { result } = renderHook(() =>
      useReaderChapters(7, 'version', 'layout'),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    store.dispatch(reportPageMeasurement(report))
    await vi.waitFor(() => expect(write).toHaveBeenCalled())

    expect(store.getState().reader.measurementSave?.outcome).toBeNull()
    expect(result.current.chapters?.readyChapterIds.has('10')).toBe(false)

    release()
    await vi.waitFor(() =>
      expect(store.getState().reader.measurementSave?.outcome).toBe('saved'),
    )
    await waitFor(() =>
      expect(result.current.chapters?.readyChapterIds.has('10')).toBe(true),
    )

    expect(await database.measurements.toArray()).toEqual([report])
    expect(store.getState().reader).not.toHaveProperty('measuredTargets')
    expect(store.getState().reader.measurementSave).toEqual({
      bookId: report.bookId,
      contentVersion: report.contentVersion,
      chapterId: report.chapterId,
      layoutKey: report.layoutKey,
      outcome: 'saved',
    })
  })

  it.each([true, false])(
    'commits zero pages with complete cache %s',
    async (complete) => {
      await seedContent()
      await database.content.update(7, {
        complete,
        progress: {
          sectionNextOffset: null,
          segmentNextOffset: null,
          lastSegmentSequence: null,
        },
      })
      const measurement = createMeasurement()
      await saveChapterMeasurement(measurement)

      await saveChapterMeasurement({
        ...measurement,
        pages: [],
        unmappableSegmentIds: [],
      })

      expect(await database.measurements.toArray()).toEqual([
        { ...measurement, pages: [], unmappableSegmentIds: [] },
      ])
    },
  )

  it('caches an older layout without overwriting the newer save outcome', async () => {
    await seedContent()
    const store = createAppStore()
    const older = createMeasurement()
    const newer = { ...older, layoutKey: 'new-layout' }
    const olderWrite = pauseMeasurementWrite()
    const outcomes: ReaderMeasurementSave[] = []
    const unsubscribe = store.subscribe(() => {
      const result = store.getState().reader.measurementSave
      if (result?.outcome) outcomes.push(result)
    })

    store.dispatch(reportPageMeasurement(older))
    await vi.waitFor(() => expect(olderWrite.write).toHaveBeenCalled())
    store.dispatch(reportLayoutKey(newer.layoutKey))
    store.dispatch(reportPageMeasurement(newer))
    olderWrite.release()
    await vi.waitFor(() =>
      expect(store.getState().reader.measurementSave?.outcome).toBe('saved'),
    )
    unsubscribe()

    expect(await database.measurements.toArray()).toEqual([older, newer])
    expect(outcomes).toEqual([
      {
        bookId: newer.bookId,
        contentVersion: newer.contentVersion,
        chapterId: newer.chapterId,
        layoutKey: newer.layoutKey,
        outcome: 'saved',
      },
    ])
  })

  it.each(['contentVersion', 'chapterId', 'width'] as const)(
    'rejects an invalid %s',
    async (field) => {
      await seedContent()
      const report = createMeasurement()
      const invalid = { ...report, [field]: field === 'width' ? 0 : 'missing' }
      const store = createAppStore()

      store.dispatch(reportPageMeasurement(invalid))
      await vi.waitFor(() =>
        expect(store.getState().reader.measurementSave?.outcome).toBe(
          'rejected',
        ),
      )

      expect(await database.measurements.count()).toBe(0)
    },
  )

  it.each([
    deleteLocalContent,
    async (bookId: number) => {
      const content = (await database.content.get(bookId))!
      await initializeContentStaging({
        ...content,
        version: 'replacement',
        complete: false,
      })
    },
  ])(
    'clears records and rejects a late report after content removal or replacement',
    async (removeContent) => {
      await seedContent()
      const measurement = createMeasurement()
      await saveChapterMeasurement(measurement)
      await database.measurements.put({ ...measurement, bookId: 8 })

      await removeContent(7)
      const outcome = await saveChapterMeasurement(measurement)

      expect(outcome).toBe('rejected')
      expect(
        (await database.measurements.toArray()).map((row) => row.bookId),
      ).toEqual([8])
    },
  )

  it.each(['sectionNextOffset', 'segmentNextOffset'] as const)(
    'requires a committed %s checkpoint',
    async (checkpoint) => {
      const content = await seedContent()
      await database.content.put({
        ...content,
        complete: false,
        progress: {
          sectionNextOffset: null,
          segmentNextOffset: null,
          lastSegmentSequence: 0,
          [checkpoint]: 1,
        },
      })
      const measurement = createMeasurement()

      expect(await saveChapterMeasurement(measurement)).toBe('rejected')
      expect(await database.measurements.count()).toBe(0)
    },
  )

  it('surfaces a write failure and accepts an explicit retry', async () => {
    await seedContent()
    const store = createAppStore()
    const { result } = renderHook(() =>
      useReaderChapters(7, 'version', 'layout'),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    vi.spyOn(database.measurements, 'put').mockRejectedValueOnce(
      new Error('quota'),
    )

    store.dispatch(reportPageMeasurement(createMeasurement()))
    await vi.waitFor(() =>
      expect(store.getState().reader.measurementSave?.outcome).toBe('failed'),
    )

    expect(await database.measurements.count()).toBe(0)
    expect(result.current.chapters?.readyChapterIds.has('10')).toBe(false)

    store.dispatch(reportPageMeasurement(createMeasurement()))
    await vi.waitFor(() =>
      expect(store.getState().reader.measurementSave?.outcome).toBe('saved'),
    )

    expect(await database.measurements.count()).toBe(1)
  })

  it('serializes a pending save with content deletion', async () => {
    await seedContent()
    const measurement = createMeasurement()
    const { release, write } = pauseMeasurementWrite()

    const saving = saveChapterMeasurement(measurement)
    await vi.waitFor(() => expect(write).toHaveBeenCalled())
    const deleting = deleteLocalContent(7)
    release()
    await Promise.all([saving, deleting])

    expect(await database.measurements.count()).toBe(0)
    expect(await database.content.get(7)).toBeUndefined()
  })

  it('preserves version-five content and legacy data on migration', async () => {
    const content = await seedContent()
    const schemas = Object.fromEntries(
      database.tables
        .filter((table) => table.name !== 'measurements')
        .map((table) => [
          table.name,
          [
            table.schema.primKey.src,
            ...table.schema.indexes.map((index) => index.src),
          ].join(', '),
        ]),
    )
    await database.delete()
    const old = new Dexie(database.name)
    old.version(5).stores(schemas)
    await old.table('content').put(content)
    await old.table('sections').put({ bookId: 7, version: 'version', id: 10 })
    await old
      .table('segments')
      .put({ bookId: 7, version: 'version', sequence: 0 })
    await old
      .table('recordings')
      .put({ id: 'voice', blob: new Blob(['voice']) })
    await old.table('contentPositions').put({ bookId: 7, offset: 3 })
    old.close()

    await database.open()

    expect(await database.content.get(7)).toEqual(content)
    expect(await database.sections.count()).toBe(1)
    expect(await database.segments.count()).toBe(1)
    expect(await database.recordings.count()).toBe(1)
    expect((await database.contentPositions.get(7))?.offset).toBe(3)
    expect(await database.measurements.count()).toBe(0)
  })
})
