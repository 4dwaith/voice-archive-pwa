// @vitest-environment jsdom
import '../helpers/database'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import {
  readReaderPreferences,
  READER_PREFERENCES_KEY,
} from '../../src/data/readerPreferences'
import { createAppStore } from '../../src/store/store'
import {
  adjustPlaybackSpeed,
  setPlaybackSpeed,
  selectPlaybackSpeed,
} from '../../src/store/playbackSpeedSlice'
import { increaseTextSize } from '../../src/store/textSizeSlice'
import {
  openReader,
  closeReader,
  setReaderAnchor,
  setReaderViewMode,
  selectSegment,
  reportLayoutKey,
  getLayoutKey,
} from '../../src/store/readerSlice'
import { seedContent } from '../helpers/readerMeasurements'

afterEach(async () => {
  vi.restoreAllMocks()
})

describe('Reader preferences', () => {
  it('uses exact speed steps and stops at both limits', () => {
    const store = createAppStore()

    expect(selectPlaybackSpeed(store.getState())).toBe(1)

    store.dispatch(adjustPlaybackSpeed(1))

    expect(selectPlaybackSpeed(store.getState())).toBe(1.05)

    for (let count = 0; count < 40; count++)
      store.dispatch(adjustPlaybackSpeed(-1))

    expect(selectPlaybackSpeed(store.getState())).toBe(0.75)

    for (let count = 0; count < 40; count++)
      store.dispatch(adjustPlaybackSpeed(1))

    expect(selectPlaybackSpeed(store.getState())).toBe(2)
  })

  it('persists speed alongside existing preferences without invalidating layout', () => {
    localStorage.setItem(
      READER_PREFERENCES_KEY,
      JSON.stringify({
        textSizeStep: 3,
        viewMode: 'pdf',
        positions: { 7: { version: 'v', sourceKey: 'text', offset: 2 } },
      }),
    )
    const store = createAppStore()
    store.dispatch(reportLayoutKey('layout'))

    store.dispatch(setPlaybackSpeed(1.35))

    expect(getLayoutKey(store.getState())).toBe('layout')
    expect(readReaderPreferences()).toMatchObject({
      textSizeStep: 3,
      playbackSpeedStep: 12,
      viewMode: 'pdf',
      positions: { 7: { version: 'v', sourceKey: 'text', offset: 2 } },
    })
    expect(selectPlaybackSpeed(createAppStore().getState())).toBe(1.35)
  })

  it.each([-1, 26, 0.5, 'invalid'])(
    'defaults malformed saved speed %s without dropping text size',
    (playbackSpeedStep) => {
      localStorage.setItem(
        READER_PREFERENCES_KEY,
        JSON.stringify({ textSizeStep: 3, playbackSpeedStep }),
      )

      const store = createAppStore()

      expect(selectPlaybackSpeed(store.getState())).toBe(1)
      expect(readReaderPreferences().textSizeStep).toBe(3)
    },
  )

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
    'clears selected text on reader %s',
    (event) => {
      const store = createAppStore()
      const scope = { bookId: 7, contentVersion: 'version' }
      store.dispatch(openReader(scope))
      store.dispatch(selectSegment(1))

      store.dispatch(
        event === 'open'
          ? openReader({ ...scope, contentVersion: 'new' })
          : closeReader(scope),
      )

      expect(store.getState().reader.selectedSegmentId).toBeNull()
    },
  )

  it.each([
    'broken json',
    '{"textSizeStep":-1}',
    '{"textSizeStep":1.5}',
    '{"textSizeStep":33}',
  ])('ignores malformed preferences %s', (raw) => {
    localStorage.setItem(READER_PREFERENCES_KEY, raw)

    expect(readReaderPreferences()).toEqual({
      textSizeStep: 0,
      playbackSpeedStep: 5,
      positions: {},
    })
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
      playbackSpeedStep: 5,
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
