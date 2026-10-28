// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { database } from '../../src/data/database'
import { createMeasurement, seedContent } from '../helpers/readerMeasurements'
import Dexie from 'dexie'
import { useReaderChapters } from '../../src/hooks/useReaderChapters'
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
import type { ReaderMeasurementSave } from '../../src/models/reader'

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
            ...table.schema.indexes
              .filter((index) => index.name !== '[bookId+version+id]')
              .map((index) => index.src),
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
      .put({ bookId: 7, version: 'version', sequence: 0, id: 1 })
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
    expect(
      await database.segments
        .where('[bookId+version+id]')
        .equals([7, 'version', 1])
        .count(),
    ).toBe(1)
  })
})
