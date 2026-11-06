// @vitest-environment jsdom
import '../helpers/database'
import { describe, expect, it } from 'vitest'
import { database } from '../../src/data/database'
import { createLiveQueries } from '../../src/services/liveQueries'
import { createAppStore } from '../../src/store/store'
import {
  openReader,
  setReaderAnchor,
  reportLayoutKey,
} from '../../src/store/readerSlice'
import { createMeasurement, seedContent } from '../helpers/readerMeasurements'
import { book } from '../api-client/fixtures/book'

const scope = { bookId: 7, contentVersion: 'version' }
const getPath = () => '/books/7'

function createQueries(anchorOffset = 0) {
  const store = createAppStore()
  store.dispatch(openReader(scope))
  const anchor = { segmentId: 1, offset: anchorOffset }
  store.dispatch(setReaderAnchor({ ...scope, anchor }))
  store.dispatch(reportLayoutKey('layout'))
  return {
    store,
    queries: createLiveQueries(store.getState, getPath),
  }
}

describe('Live book evidence', () => {
  it('paginates saved metadata beyond the visible shelf without claiming completeness', async () => {
    await database.books.bulkPut(
      Array.from({ length: 25 }, (_, index) => ({ ...book, id: index + 1 })),
    )
    await database.libraryCatalog.put({
      id: 'catalog',
      total: 40,
      complete: false,
    })
    const { queries } = createQueries()

    const first = await queries.listAvailableBooks({})
    const next = await queries.listAvailableBooks({ offset: first.nextOffset! })

    expect(first).toMatchObject({
      nextOffset: 24,
      complete: false,
      cachedCount: 25,
      total: 40,
    })
    expect(next.items.map(({ id }) => id)).toEqual([25])
    expect(next.nextOffset).toBeNull()
  })

  it('reads saved identity without opening the reader', async () => {
    await database.books.put({ ...book, id: 7 })
    const { queries } = createQueries()

    expect(await queries.getBookInfo({ bookId: 7 })).toMatchObject({
      book: { ...book, id: 7 },
      contentVersion: null,
      identitySource: 'unavailable',
    })

    await seedContent()

    expect(await queries.getBookInfo({ bookId: 7 })).toMatchObject({
      contentVersion: 'version',
      identitySource: 'cache',
    })
  })

  it.each([
    ['missing', 'unavailable'],
    ['old', 'stale'],
    ['partial', 'partial'],
    ['sections', 'ready'],
    ['complete', 'ready'],
  ])('reports local ToC availability: %s', async (mode, status) => {
    if (mode !== 'missing') {
      await seedContent()
      await database.content.update(7, {
        complete: mode === 'complete',
        progress: {
          sectionNextOffset: mode === 'sections' ? null : 1,
          segmentNextOffset: 0,
          lastSegmentSequence: null,
        },
      })
    }
    const { queries } = createQueries()

    const result = await queries.getBookToc({
      ...scope,
      contentVersion: mode === 'old' ? 'old' : scope.contentVersion,
    })

    expect(result.status).toBe(status)
    expect(
      result.sections?.map(({ id, parent_id }) => [id, parent_id]),
    ).toEqual(['missing', 'old'].includes(mode) ? undefined : [[10, null]])
  })

  it.each([
    ['version', 'partial', [1], [99]],
    ['old', 'stale', undefined, undefined],
  ] as const)(
    'scopes exact cached IDs to the requested version: %s',
    async (contentVersion, status, ids, missingIds) => {
      await seedContent()
      await database.content.update(7, { complete: false })
      const other = (await database.segments.toArray())[0]
      await database.segments.put({ ...other, bookId: 8, id: 99 })
      const { queries } = createQueries()

      const result = await queries.getSegments({
        ...scope,
        contentVersion,
        segmentIds: [1, 99],
      })

      expect(result.status).toBe(status)
      expect(result.segments?.map(({ id }) => id)).toEqual(ids)
      expect(result.missingIds).toEqual(missingIds)
    },
  )
})

describe('Live Text pages', () => {
  it.each([
    [2, 0, 'ready', 'ಕಾZB', 'normal'],
    [2, 1, 'ready', 'invalid', 'normal'],
    [2, -1, 'ready', 'A😀', 'normal'],
    [0, -1, 'edge', undefined, 'normal'],
    [2, 1, 'preparing', undefined, 'gap'],
    [0, 0, 'unavailable', undefined, 'grapheme'],
    [0, 0, 'unavailable', undefined, 'source'],
    [0, 0, 'stale', undefined, 'layout'],
  ] as const)(
    'reads offset %s/%s with %s bounds (%s, %s)',
    async (anchorOffset, offset, status, text, mode) => {
      await seedContent()
      await database.sections.update([7, 'version', 10], {
        first_segment_source_key: 'unmappable',
      })
      await database.segments.update([7, 'version', 3], {
        text_content: 'A😀ಕಾZ',
        html_content: '<p>A😀ಕಾZ</p>',
        section_id: null,
        root_section_id: null,
      })
      await database.segments.update([7, 'version', 6], {
        html_content: '<p>invalid</p>',
      })
      const segment = (await database.segments.toArray())[0]
      await database.segments.put({
        ...segment,
        id: 99,
        sequence: 4,
        source_key: 'tail',
        text_content: 'BC',
        html_content: '<p>BC</p>',
      })
      await database.content.update(7, { 'manifest.segment_count': 3 })
      const measurement = createMeasurement()
      const createPosition = (offset: number) => ({
        ...measurement.pages[0].start!,
        offset,
      })
      const firstPage = {
        localPage: 1,
        start: createPosition(0),
        end: createPosition(mode === 'grapheme' ? 3 : 2),
      }
      if (mode === 'source') firstPage.start.sourceKey = 'old'
      await database.measurements.bulkPut([
        {
          ...measurement,
          chapterId: 'before',
          pages: [
            firstPage,
            {
              localPage: 2,
              start: createPosition(2),
              end: { segmentId: 99, sourceKey: 'tail', offset: 1 },
            },
          ],
        },
        ...(mode === 'gap'
          ? []
          : [
              {
                ...measurement,
                unmappableSegmentIds: [],
                pages: [
                  {
                    localPage: 1,
                    start: { segmentId: 2, sourceKey: 'unmappable', offset: 0 },
                    end: { segmentId: 2, sourceKey: 'unmappable', offset: 7 },
                  },
                ],
              },
            ]),
      ])
      const { queries, store } = createQueries(anchorOffset)

      const pending = queries.getTextPage({ offset })
      if (mode === 'layout') store.dispatch(reportLayoutKey('new'))
      const result = await pending

      expect(result.status).toBe(status)
      expect(result.fragments?.map((fragment) => fragment.text).join('')).toBe(
        text,
      )
    },
  )
})
