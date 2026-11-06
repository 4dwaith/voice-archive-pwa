// @vitest-environment jsdom
import '../helpers/database'
import { describe, expect, it, vi } from 'vitest'
import { database } from '../../src/data/database'
import { createAppStore } from '../../src/store/store'
import {
  getReaderCommandError,
  requestReaderCommand,
} from '../../src/store/readerCommandsSlice'
import {
  getReaderAnchor,
  getSelectedSegmentId,
  openReader,
  reportLayoutKey,
  selectSegment,
  setReaderAnchor,
} from '../../src/store/readerSlice'
import { increaseTextSize } from '../../src/store/textSizeSlice'
import { createMeasurement, seedContent } from '../helpers/readerMeasurements'

const scope = { bookId: 7, contentVersion: 'version' }

describe('Reader commands', () => {
  it.each([999, null])(
    'rejects missing selection or stale content: %s',
    async (segmentId) => {
      await seedContent()
      const store = createAppStore()
      store.dispatch(
        openReader({
          ...scope,
          contentVersion: segmentId === null ? 'stale' : 'version',
        }),
      )

      store.dispatch(
        requestReaderCommand({ kind: 'selectSegment', ...scope, segmentId }),
      )

      await vi.waitFor(() =>
        expect(getReaderCommandError(store.getState())).not.toBeNull(),
      )
      expect(getSelectedSegmentId(store.getState())).toBeNull()
    },
  )

  it('retains refresh failure in the command slice', async () => {
    const store = createAppStore()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    )

    store.dispatch(requestReaderCommand({ kind: 'refreshLibrary' }))

    await vi.waitFor(() =>
      expect(getReaderCommandError(store.getState())?.message).toContain(
        'could not be refreshed',
      ),
    )
  })

  it('keeps a manual selection made during validation', async () => {
    await seedContent()
    const store = createAppStore()
    store.dispatch(openReader(scope))

    store.dispatch(
      requestReaderCommand({ kind: 'selectSegment', ...scope, segmentId: 1 }),
    )
    store.dispatch(selectSegment(2))
    await database.segments.toArray()

    expect(getSelectedSegmentId(store.getState())).toBe(2)
    expect(getReaderCommandError(store.getState())).toBeNull()
  })

  it.each([
    { action: { type: 'waitForReflow' }, expectedOffset: 1 },
    { action: selectSegment(2), expectedOffset: 0 },
  ])(
    'resolves after reflow unless superseded by $action.type',
    async ({ action, expectedOffset }) => {
      await seedContent()
      const store = createAppStore()
      const anchor = { segmentId: 1, offset: 0 }
      store.dispatch(openReader(scope))
      store.dispatch(setReaderAnchor({ ...scope, anchor }))
      store.dispatch(increaseTextSize())

      store.dispatch(
        requestReaderCommand({ kind: 'moveTextPage', direction: 'next' }),
      )

      expect(getReaderAnchor(store.getState())).toEqual(anchor)
      store.dispatch(action)

      const measurement = createMeasurement()
      measurement.pages = [
        {
          ...measurement.pages[0],
          end: { segmentId: 1, sourceKey: 'text', offset: 1 },
        },
        {
          localPage: 2,
          start: { segmentId: 1, sourceKey: 'text', offset: 1 },
          end: { segmentId: 1, sourceKey: 'text', offset: 3 },
        },
      ]
      await database.measurements.bulkPut([
        measurement,
        { ...measurement, chapterId: 'before', pages: [] },
      ])
      store.dispatch(reportLayoutKey('layout'))

      await vi.waitFor(() =>
        expect(getReaderAnchor(store.getState())).toEqual({
          segmentId: 1,
          offset: expectedOffset,
        }),
      )
    },
  )
})
