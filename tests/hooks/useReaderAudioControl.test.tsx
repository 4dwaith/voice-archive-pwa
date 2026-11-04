// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook } from '@testing-library/react'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReaderAudioControl } from '../../src/hooks/useReaderAudioControl'
import { createAppStore } from '../../src/store/store'
import {
  openReader,
  selectSegment,
  setReaderAnchor,
} from '../../src/store/readerSlice'
import {
  getReaderAudioPlaybackRequest,
  setReaderAudioPlayback,
  seekReaderAudioBySeconds,
} from '../../src/store/readerAudioSlice'
import { idleReaderAudioSnapshot } from '../../src/services/readerAudioController'
import type { ReaderAudioSnapshot } from '../../src/models/readerAudio'

afterEach(cleanup)

const scope = { bookId: 7, contentVersion: 'version' }

function renderControl() {
  const store = createAppStore()
  store.dispatch(openReader(scope))
  const getSnapshot = vi.fn((): ReaderAudioSnapshot => idleReaderAudioSnapshot)
  const player = {
    getSnapshot,
    playFromSegment: vi.fn(() => {
      getSnapshot.mockReturnValue({
        ...idleReaderAudioSnapshot,
        isPlaying: true,
        status: 'preparing',
      })
    }),
    pausePlayback: vi.fn(() => {
      getSnapshot.mockReturnValue({
        ...idleReaderAudioSnapshot,
        status: 'paused',
      })
    }),
    selectSegment: vi.fn(),
    seekBySeconds: vi.fn(async () => {}),
  }
  renderHook(
    () =>
      useReaderAudioControl(
        player,
        scope.bookId,
        scope.contentVersion,
        null,
        true,
      ),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      ),
    },
  )
  return { store, player }
}

describe('Reader audio Redux control', () => {
  it('plays and selects an explicit target without waiting for pagination', () => {
    const { store, player } = renderControl()

    act(() => {
      store.dispatch(
        setReaderAudioPlayback({ ...scope, isPlaying: true, segmentId: 2 }),
      )
    })

    expect(player.playFromSegment).toHaveBeenCalledExactlyOnceWith(2)
    expect(player.selectSegment).toHaveBeenCalledExactlyOnceWith(2)
    expect(store.getState().reader.selectedSegmentId).toBe(2)
  })

  it('pauses synchronously before the caller can navigate', () => {
    const { store, player } = renderControl()
    act(() => store.dispatch(selectSegment(2)))

    act(() => {
      store.dispatch(
        setReaderAudioPlayback({
          ...scope,
          isPlaying: false,
          restartFromPage: true,
        }),
      )

      expect(player.pausePlayback).toHaveBeenCalledExactlyOnceWith(null, true)
      expect(store.getState().reader.selectedSegmentId).toBeNull()
    })
  })

  it('executes every relative seek in a batch', () => {
    const { store, player } = renderControl()

    act(() => {
      store.dispatch(seekReaderAudioBySeconds({ ...scope, seconds: 5 }))
      store.dispatch(seekReaderAudioBySeconds({ ...scope, seconds: 5 }))
    })

    expect(player.seekBySeconds).toHaveBeenCalledTimes(2)
    expect(player.seekBySeconds).toHaveBeenNthCalledWith(1, 5)
    expect(player.seekBySeconds).toHaveBeenNthCalledWith(2, 5)
  })

  it('retargets selection while anchor feedback leaves playback alone', () => {
    const { store, player } = renderControl()

    act(() => {
      store.dispatch(selectSegment(3))
      store.dispatch(
        setReaderAnchor({ ...scope, anchor: { segmentId: 4, offset: 0 } }),
      )
    })

    expect(player.selectSegment).toHaveBeenCalledExactlyOnceWith(3)
    expect(player.playFromSegment).not.toHaveBeenCalled()
  })

  it('ignores another dataset and clears the request when the reader changes', () => {
    const { store, player } = renderControl()

    act(() => {
      store.dispatch(
        setReaderAudioPlayback({
          ...scope,
          contentVersion: 'old',
          isPlaying: true,
          segmentId: 2,
        }),
      )
      store.dispatch(
        seekReaderAudioBySeconds({ ...scope, bookId: 8, seconds: 5 }),
      )
      store.dispatch(openReader({ ...scope, contentVersion: 'new' }))
    })

    expect(player.playFromSegment).not.toHaveBeenCalled()
    expect(player.seekBySeconds).not.toHaveBeenCalled()
    expect(getReaderAudioPlaybackRequest(store.getState())).toBeNull()
  })
})
