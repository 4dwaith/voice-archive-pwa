// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { database } from '../../src/data/database'
import { createMeasurement, seedContent } from '../helpers/readerMeasurements'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { useReaderNavigation } from '../../src/hooks/useReaderNavigation'
import { deleteLocalContent } from '../../src/data/contentRepository'
import { createAppStore } from '../../src/store/store'
import {
  openReader,
  closeReader,
  setReaderAnchor,
  reportLayoutKey,
} from '../../src/store/readerSlice'

beforeEach(async () => {
  await database.delete()
  await database.open()
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await database.delete()
})

describe('Reader anchor navigation', () => {
  function renderNavigation() {
    const store = createAppStore()
    const hook = renderHook(({ version }) => useReaderNavigation(7, version), {
      initialProps: { version: 'version' },
      wrapper: ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      ),
    })
    return { ...hook, store }
  }

  it('initializes when content arrives and derives pages from committed records', async () => {
    const { result, store } = renderNavigation()
    expect(store.getState().reader.anchor).toBeNull()

    await act(seedContent)
    await waitFor(() =>
      expect(store.getState().reader.anchor).toEqual({
        segmentId: 1,
        offset: 0,
      }),
    )

    expect(result.current.currentPage).toBeNull()
    act(() => {
      store.dispatch(reportLayoutKey('layout'))
    })
    await act(async () => {
      await database.measurements.bulkPut([
        {
          ...createMeasurement(),
          chapterId: 'before',
          pages: [],
          unmappableSegmentIds: [],
        },
        createMeasurement(),
      ])
    })
    await waitFor(() => expect(result.current.globalPage).toBe(1))

    expect(result.current.pageCount).toBe(1)
    expect(result.current.totalPageCount).toBe(1)
    expect(store.getState().reader.anchor).toEqual({ segmentId: 1, offset: 0 })
  })

  it('preserves the anchor through layout changes and maps focus to a known page start', async () => {
    await seedContent()
    const { result, store } = renderNavigation()
    await waitFor(() => expect(store.getState().reader.anchor).not.toBeNull())
    act(() => {
      store.dispatch(
        setReaderAnchor({
          bookId: 7,
          contentVersion: 'version',
          anchor: { segmentId: 1, offset: 2 },
        }),
      )
      store.dispatch(reportLayoutKey('changed'))
    })
    await act(async () => {
      const measurement = createMeasurement()
      const boundary = { segmentId: 1, sourceKey: 'text', offset: 1 }
      await database.measurements.put({
        ...measurement,
        layoutKey: 'changed',
        pages: [
          { ...measurement.pages[0], end: boundary },
          { localPage: 2, start: boundary, end: measurement.pages[0].end },
        ],
      })
    })
    await waitFor(() => expect(result.current.currentPage).toBe(2))

    expect(result.current.globalPage).toBeNull()
    expect(store.getState().reader.anchor?.offset).toBe(2)

    act(() => {
      result.current.setCurrentPage(2)
    })

    expect(store.getState().reader.anchor?.offset).toBe(1)

    act(() => {
      store.dispatch(reportLayoutKey('unmeasured'))
    })
    await waitFor(() => expect(result.current.currentPage).toBeNull())

    expect(store.getState().reader.anchor?.offset).toBe(1)
    expect(result.current.pageCount).toBeNull()
  })

  it('clears removed content and initializes a replacement without reusing its offset', async () => {
    const content = await seedContent()
    const { rerender, store } = renderNavigation()
    await waitFor(() => expect(store.getState().reader.anchor).not.toBeNull())
    act(() => {
      store.dispatch(
        setReaderAnchor({
          bookId: 7,
          contentVersion: 'version',
          anchor: { segmentId: 1, offset: 2 },
        }),
      )
    })

    await act(async () => {
      await deleteLocalContent(7)
    })
    await waitFor(() => expect(store.getState().reader.anchor).toBeNull())

    await act(async () => {
      await seedContent()
      await database.content.put({ ...content, version: 'replacement' })
      await database.sections.toCollection().modify({ version: 'replacement' })
      await database.segments.toCollection().modify({ version: 'replacement' })
    })
    rerender({ version: 'replacement' })
    await waitFor(() =>
      expect(store.getState().reader.anchor).toEqual({
        segmentId: 1,
        offset: 0,
      }),
    )

    act(() => {
      store.dispatch(closeReader({ bookId: 7, contentVersion: 'version' }))
      store.dispatch(
        setReaderAnchor({
          bookId: 7,
          contentVersion: 'version',
          anchor: { segmentId: 2, offset: 2 },
        }),
      )
    })

    expect(store.getState().reader.scope?.contentVersion).toBe('replacement')
    expect(store.getState().reader.anchor).toEqual({ segmentId: 1, offset: 0 })
  })

  it('initializes leading unsectioned text as Before', async () => {
    const content = await seedContent()
    await database.sections.clear()
    await database.content.put({
      ...content,
      manifest: { ...content.manifest, section_count: 0 },
    })
    await database.segments
      .toCollection()
      .modify({ section_id: null, root_section_id: null })
    const { result, store } = renderNavigation()

    await waitFor(() =>
      expect(store.getState().reader.anchor).toEqual({
        segmentId: 1,
        offset: 0,
      }),
    )
    act(() => {
      store.dispatch(reportLayoutKey('layout'))
    })
    await act(async () => {
      await database.measurements.put({
        ...createMeasurement(),
        chapterId: 'before',
      })
    })
    await waitFor(() => expect(result.current.globalPage).toBe(1))

    expect(result.current.totalPageCount).toBe(1)
  })

  it('keeps a different book active when the old provider unmounts', async () => {
    const { unmount, store } = renderNavigation()

    act(() => {
      store.dispatch(openReader({ bookId: 8, contentVersion: 'other' }))
    })
    unmount()

    expect(store.getState().reader.scope?.bookId).toBe(8)
    expect(store.getState().reader.anchor).toBeNull()
  })
})
