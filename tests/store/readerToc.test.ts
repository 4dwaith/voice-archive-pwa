// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { database } from '../../src/data/database'
import { seedContent, createMeasurement } from '../helpers/readerMeasurements'
import * as contentRepository from '../../src/data/contentRepository'
import * as chapterRepository from '../../src/data/readerChapterRepository'
import type { CachedSegment } from '../../src/models/content'
import { createAppStore } from '../../src/store/store'
import {
  openReader,
  selectSection,
  setReaderAnchor,
  reportLayoutKey,
  reportTocNavigationError,
  closeReader,
} from '../../src/store/readerSlice'

const scope = { bookId: 7, contentVersion: 'version' }
const existingAnchor = { segmentId: 1, offset: 2 }

beforeEach(async () => {
  await database.delete()
  await database.open()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await database.delete()
})

async function navigateToSection(sectionId: number, layoutKey = 'layout') {
  const store = createAppStore()
  store.dispatch(openReader(scope))
  store.dispatch(reportLayoutKey(layoutKey))
  store.dispatch(setReaderAnchor({ ...scope, anchor: existingAnchor }))

  store.dispatch(selectSection(sectionId))
  await waitFor(() =>
    expect(
      store.getState().reader.anchor?.offset === 0 ||
        store.getState().reader.tocNavigationError,
    ).toBeTruthy(),
  )

  return store.getState().reader
}

describe('ToC targets', () => {
  async function seedNestedSection() {
    await seedContent()
    const root = (await database.sections.get([7, 'version', 10]))!
    await database.sections.put({ ...root, id: 5, parent_id: 10, sequence: 1 })
    await database.content.update(7, { 'manifest.section_count': 2 })
    await database.measurements.put(createMeasurement())
  }

  it('rejects an unmeasured destination', async () => {
    await seedNestedSection()

    const reader = await navigateToSection(5, 'other-layout')

    expect(reader.anchor).toEqual(existingAnchor)
    expect(reader.tocNavigationError).toContain('No readable text target')
  })

  it.each([
    { name: 'an empty section', sourceKey: null },
    { name: 'a missing segment', sourceKey: 'missing' },
    { name: 'unmappable text', sourceKey: 'unmappable' },
  ])('keeps the position for $name', async ({ sourceKey }) => {
    await seedNestedSection()
    await database.sections.update([7, 'version', 5], {
      first_segment_source_key: sourceKey,
    })

    const reader = await navigateToSection(5)

    expect(reader.anchor).toEqual(existingAnchor)
    expect(reader.tocNavigationError).toContain('No readable text target')
  })

  it('returns to the beginning of Before', async () => {
    await seedContent()
    await database.sections.clear()
    await database.content.update(7, { 'manifest.section_count': 0 })
    await database.measurements.put({
      ...createMeasurement(),
      chapterId: 'before',
    })

    const reader = await navigateToSection(0)

    expect(reader.anchor).toEqual({ segmentId: 1, offset: 0 })
  })

  it('rejects an obsolete content version', async () => {
    await seedNestedSection()
    await database.content.update(7, { version: 'replacement' })

    const reader = await navigateToSection(5)

    expect(reader.anchor).toEqual(existingAnchor)
    expect(reader.tocNavigationError).toContain('No readable text target')
  })
})

describe('ToC selection coordination', () => {
  beforeEach(async () => {
    await seedContent()
    await database.measurements.put(createMeasurement())
  })

  function createReaderStore() {
    const store = createAppStore()
    store.dispatch(openReader(scope))
    store.dispatch(reportLayoutKey('layout'))
    return store
  }

  it('returns to the start when reselected', async () => {
    const store = createReaderStore()

    store.dispatch(selectSection(10))
    await waitFor(() =>
      expect(store.getState().reader.anchor).toEqual({
        segmentId: 1,
        offset: 0,
      }),
    )

    store.dispatch(setReaderAnchor({ ...scope, anchor: existingAnchor }))
    store.dispatch(selectSection(10))
    await waitFor(() =>
      expect(store.getState().reader.anchor).toEqual({
        segmentId: 1,
        offset: 0,
      }),
    )
  })

  it('clears the ToC error after direct navigation', () => {
    const store = createReaderStore()
    store.dispatch(reportTocNavigationError('The section could not be opened.'))

    store.dispatch(setReaderAnchor({ ...scope, anchor: existingAnchor }))

    expect(store.getState().reader.anchor).toEqual(existingAnchor)
    expect(store.getState().reader.tocNavigationError).toBeNull()
  })

  it.each([
    {
      name: 'an old book closes',
      action: closeReader({ ...scope, bookId: 8 }),
    },
    {
      name: 'an old version navigates',
      action: setReaderAnchor({
        ...scope,
        contentVersion: 'old-version',
        anchor: { segmentId: 9, offset: 0 },
      }),
    },
  ])('keeps the lookup when $name', async ({ action }) => {
    const target = (await database.segments.get([7, 'version', 3]))!
    let finish!: (segment: CachedSegment) => void
    const pending = new Promise<CachedSegment>((resolve) => {
      finish = resolve
    })
    vi.spyOn(contentRepository, 'getSectionFirstSegment').mockReturnValue(
      pending,
    )
    const store = createReaderStore()
    store.dispatch(selectSection(10))

    store.dispatch(action)
    finish(target)
    await waitFor(() =>
      expect(store.getState().reader.anchor).toEqual({
        segmentId: 1,
        offset: 0,
      }),
    )
  })

  it.each(['selection', 'layout', 'book', 'close', 'anchor'] as const)(
    'discards a late lookup after a newer %s',
    async (change) => {
      const target = (await database.segments.get([7, 'version', 3]))!
      const readiness = await chapterRepository.readReaderChapterReadiness(
        7,
        'version',
        'layout',
      )
      vi.spyOn(
        chapterRepository,
        'readReaderChapterReadiness',
      ).mockResolvedValue(readiness)
      let finish!: (segment: CachedSegment) => void
      const pending = new Promise<CachedSegment>((resolve) => {
        finish = resolve
      })
      vi.spyOn(contentRepository, 'getSectionFirstSegment')
        .mockReturnValueOnce(pending)
        .mockResolvedValue(undefined)
      const store = createReaderStore()
      store.dispatch(selectSection(5))

      const actions = {
        selection: selectSection(10),
        layout: reportLayoutKey('changed'),
        book: openReader({ bookId: 8, contentVersion: 'other' }),
        close: closeReader(scope),
        anchor: setReaderAnchor({
          ...scope,
          anchor: { segmentId: 9, offset: 0 },
        }),
      }
      store.dispatch(actions[change])
      finish(target)
      await pending
      // Let the listener finish its readiness await before checking the result.
      await Promise.resolve()

      expect(store.getState().reader.anchor?.segmentId).not.toBe(1)
    },
  )
})
