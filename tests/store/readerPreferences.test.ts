// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import {
  readReaderPreferences,
  READER_PREFERENCES_KEY,
} from '../../src/data/readerPreferences'
import { createAppStore } from '../../src/store/store'
import { increaseTextSize } from '../../src/store/textSizeSlice'
import {
  openReader,
  closeReader,
  setReaderAnchor,
  setReaderViewMode,
  selectSegment,
  highlightSegment,
} from '../../src/store/readerSlice'
import { database } from '../../src/data/database'
import { seedContent } from '../helpers/readerMeasurements'

beforeEach(async () => {
  await database.delete()
  await database.open()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await database.delete()
})

describe('Reader preferences', () => {
  it('restores and persists the reading view without dropping other preferences', () => {
    localStorage.setItem(
      READER_PREFERENCES_KEY,
      '{"textSizeStep":3,"viewMode":"pdf"}',
    )
    const store = createAppStore()

    expect(store.getState().reader.viewMode).toBe('pdf')

    store.dispatch(setReaderViewMode('text'))
    store.dispatch(increaseTextSize())

    expect(readReaderPreferences()).toMatchObject({
      viewMode: 'text',
      textSizeStep: 4,
    })
  })

  it.each(['invalid', 'both', null, 4])(
    'falls back to text for unknown mode %s',
    (viewMode) => {
      localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify({ viewMode }))

      expect(createAppStore().getState().reader.viewMode).toBe('text')
    },
  )

  it.each(['open', 'close'] as const)(
    'clears selected and highlighted text on reader %s',
    (event) => {
      const store = createAppStore()
      const scope = { bookId: 7, contentVersion: 'version' }
      store.dispatch(openReader(scope))
      store.dispatch(selectSegment(1))
      store.dispatch(highlightSegment(2))

      store.dispatch(
        event === 'open'
          ? openReader({ ...scope, contentVersion: 'new' })
          : closeReader(scope),
      )

      expect(store.getState().reader.selectedSegmentId).toBeNull()
      expect(store.getState().reader.highlightedSegmentId).toBeNull()
    },
  )

  it.each([
    'broken json',
    '{"textSizeStep":-1}',
    '{"textSizeStep":1.5}',
    '{"textSizeStep":33}',
  ])('ignores malformed preferences %s', (raw) => {
    localStorage.setItem(READER_PREFERENCES_KEY, raw)

    expect(readReaderPreferences()).toEqual({ textSizeStep: 0, positions: {} })
  })

  it('preserves valid fields alongside an invalid book position', () => {
    localStorage.setItem(
      READER_PREFERENCES_KEY,
      JSON.stringify({
        textSizeStep: 3,
        positions: {
          7: { version: 'v', sourceKey: 'text', offset: 2 },
          8: { version: '', sourceKey: 'text', offset: -1 },
        },
      }),
    )

    expect(readReaderPreferences()).toEqual({
      textSizeStep: 3,
      positions: { 7: { version: 'v', sourceKey: 'text', offset: 2 } },
    })
  })

  it('restores text size synchronously and persists actual changes', () => {
    localStorage.setItem(READER_PREFERENCES_KEY, '{"textSizeStep":3}')
    const store = createAppStore()

    expect(store.getState().textSize.step).toBe(3)

    store.dispatch(increaseTextSize())

    expect(readReaderPreferences().textSizeStep).toBe(4)
  })

  it('saves the latest source anchor without clearing it on closure', async () => {
    await seedContent()
    const store = createAppStore()
    const scope = { bookId: 7, contentVersion: 'version' }
    store.dispatch(openReader(scope))

    store.dispatch(
      setReaderAnchor({ ...scope, anchor: { segmentId: 1, offset: 1 } }),
    )
    store.dispatch(
      setReaderAnchor({ ...scope, anchor: { segmentId: 1, offset: 2 } }),
    )
    store.dispatch(closeReader(scope))

    await waitFor(() =>
      expect(readReaderPreferences().positions[7]).toEqual({
        version: 'version',
        sourceKey: 'text',
        offset: 2,
      }),
    )
  })

  it('continues reading when storage cannot be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const store = createAppStore()

    store.dispatch(increaseTextSize())

    expect(store.getState().textSize.step).toBe(1)
  })
})
