// @vitest-environment jsdom
import '../helpers/database'
import { describe, expect, it, vi } from 'vitest'
import { database } from '../../src/data/database'
import { createAppStore } from '../../src/store/store'
import {
  getReaderCommandError,
  requestReaderCommand,
  reportCommandRoute,
} from '../../src/store/readerCommandsSlice'
import {
  getReaderAnchor,
  getSelectedSegmentId,
  getAreControlsVisible,
  openReader,
  closeReader,
  reportLayoutKey,
  selectSegment,
  setReaderAnchor,
} from '../../src/store/readerSlice'
import {
  increaseTextSize,
  selectTextSizePercent,
} from '../../src/store/textSizeSlice'
import { selectPlaybackSpeed } from '../../src/store/playbackSpeedSlice'
import { book } from '../api-client/fixtures/book'
import { createMeasurement, seedContent } from '../helpers/readerMeasurements'

const scope = { bookId: 7, contentVersion: 'version' }

describe('Reader commands', () => {
  it('rejects toggling reading controls outside a book', async () => {
    const store = createAppStore()

    store.dispatch(
      requestReaderCommand({
        kind: 'updateReaderSettings',
        controlsVisible: true,
      }),
    )

    await vi.waitFor(() =>
      expect(getReaderCommandError(store.getState())?.message).toContain(
        'Open a book',
      ),
    )
  })

  it('updates reader settings when in a book', async () => {
    await seedContent()
    const store = createAppStore()
    store.dispatch(openReader(scope))

    store.dispatch(
      requestReaderCommand({
        kind: 'updateReaderSettings',
        textSize: 150,
        playbackSpeed: 1.25,
        controlsVisible: false,
      }),
    )

    await vi.waitFor(() => {
      expect(selectTextSizePercent(store.getState())).toBe(150)
      expect(selectPlaybackSpeed(store.getState())).toBe(1.25)
      expect(getAreControlsVisible(store.getState())).toBe(false)
    })
    expect(getReaderCommandError(store.getState())).toBeNull()
  })

  it('opens an undownloaded library book without a content version', async () => {
    await database.books.put({ ...book, id: 7 })
    const store = createAppStore()
    const navigate = vi.fn()
    store.registerCommandNavigation(navigate)

    store.dispatch(requestReaderCommand({ kind: 'openBook', bookId: 7 }))

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/books/7'))
    expect(getReaderCommandError(store.getState())).toBeNull()
    expect(await database.content.get(7)).toBeUndefined()
  })

  it('rejects an unknown book before routing', async () => {
    const store = createAppStore()
    const navigate = vi.fn()
    store.registerCommandNavigation(navigate)

    store.dispatch(requestReaderCommand({ kind: 'openBook', bookId: 999 }))

    await vi.waitFor(() =>
      expect(getReaderCommandError(store.getState())).not.toBeNull(),
    )
    expect(navigate).not.toHaveBeenCalled()
  })

  it('keeps manual navigation made during book validation', async () => {
    await database.books.put({ ...book, id: 7 })
    const store = createAppStore()
    const navigate = vi.fn()
    store.registerCommandNavigation(navigate)

    store.dispatch(requestReaderCommand({ kind: 'openBook', bookId: 7 }))
    store.dispatch(reportCommandRoute('/books/8'))
    await database.books.toArray()

    expect(navigate).not.toHaveBeenCalled()
    expect(getReaderCommandError(store.getState())).toBeNull()
  })

  it.each([
    { kind: 'openBook', contentVersion: 'stale' },
    { kind: 'navigateToSection', sectionId: 999 },
    { kind: 'navigateToSegment', segmentId: 1, offset: 9 },
    {
      kind: 'startPlayback',
      destination: { bookId: 7, target: 'segment', segmentId: 1 },
    },
  ] as const)(
    'rejects unavailable targets before routing: $kind',
    async (command) => {
      await seedContent()
      const store = createAppStore()
      const navigate = vi.fn()
      store.registerCommandNavigation(navigate)

      store.dispatch(
        requestReaderCommand({
          bookId: 7,
          ...(command as any),
        }),
      )

      await vi.waitFor(() =>
        expect(getReaderCommandError(store.getState())).not.toBeNull(),
      )
      expect(navigate).not.toHaveBeenCalled()
      expect(getReaderAnchor(store.getState())).toBeNull()
    },
  )

  async function startPendingNavigation() {
    await seedContent()
    const store = createAppStore()
    const navigate = vi.fn(() => {
      store.dispatch(reportCommandRoute('/books/7'))
      store.dispatch(openReader(scope))
      store.dispatch(closeReader(scope))
      store.dispatch(openReader(scope))
      store.dispatch(reportLayoutKey('layout'))
    })
    store.registerCommandNavigation(navigate)

    store.dispatch(
      requestReaderCommand({
        kind: 'navigateToSegment',
        bookId: 7,
        segmentId: 1,
        offset: 1,
      }),
    )

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce())
    return store
  }

  it('waits for committed target layout after its own route', async () => {
    const store = await startPendingNavigation()
    expect(getReaderAnchor(store.getState())).toBeNull()

    await database.measurements.put(createMeasurement())

    await vi.waitFor(() =>
      expect(getReaderAnchor(store.getState())).toEqual({
        segmentId: 1,
        offset: 1,
      }),
    )
    expect(getSelectedSegmentId(store.getState())).toBe(1)
  })

  it('keeps a manual choice while target layout is pending', async () => {
    const store = await startPendingNavigation()
    const anchor = { segmentId: 2, offset: 0 }

    store.dispatch(reportCommandRoute('/'))
    store.dispatch(setReaderAnchor({ ...scope, anchor }))

    await database.measurements.put(createMeasurement())

    expect(getReaderAnchor(store.getState())).toEqual(anchor)
    expect(getSelectedSegmentId(store.getState())).toBeNull()
  })

  it('reports changed content after routing without applying the target', async () => {
    const store = await startPendingNavigation()

    await database.content.update(7, { version: 'new' })
    await database.measurements.put(createMeasurement())

    await vi.waitFor(() =>
      expect(getReaderCommandError(store.getState())).not.toBeNull(),
    )
    expect(getReaderAnchor(store.getState())).toBeNull()
  })

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
        requestReaderCommand({
          kind: 'selectSegment',
          bookId: 7,
          segmentId,
        }),
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
      requestReaderCommand({
        kind: 'selectSegment',
        bookId: 7,
        segmentId: 1,
      }),
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
