// @vitest-environment jsdom
import '../helpers/database'
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
  getReaderAudioObservation,
  reportReaderAudio,
  clearReaderAudioObservation,
  setReaderAudioPlayback,
  seekReaderAudioBySeconds,
} from '../../src/store/readerAudioSlice'
import {
  createReaderAudioController,
  idleReaderAudioSnapshot,
} from '../../src/services/readerAudioController'
import type { ReaderAudioSnapshot } from '../../src/models/readerAudio'

afterEach(cleanup)

const scope = { bookId: 7, contentVersion: 'version' }

type AudioPlayer = Parameters<typeof useReaderAudioControl>[0]

function renderControl(
  suppliedPlayer?: AudioPlayer,
  targetId: number | null = null,
) {
  const store = createAppStore()
  store.dispatch(openReader(scope))
  const getSnapshot = vi.fn((): ReaderAudioSnapshot => idleReaderAudioSnapshot)
  const subscribers = new Set<() => void>()

  function publishSnapshot(snapshot: ReaderAudioSnapshot) {
    getSnapshot.mockReturnValue(snapshot)
    subscribers.forEach((notify) => notify())
  }

  const player = {
    subscribe(notify: () => void) {
      subscribers.add(notify)
      return () => {
        subscribers.delete(notify)
      }
    },
    getSnapshot,
    playFromSegment: vi.fn(() => {
      publishSnapshot({
        ...idleReaderAudioSnapshot,
        isPlaying: true,
        status: 'preparing',
      })
    }),
    pausePlayback: vi.fn(() => {
      publishSnapshot({
        ...idleReaderAudioSnapshot,
        status: 'paused',
      })
    }),
    selectSegment: vi.fn(),
    seekBySeconds: vi.fn(async () => {}),
  }
  const hook = renderHook(
    ({ connectedPlayer }) =>
      useReaderAudioControl(
        connectedPlayer,
        scope.bookId,
        scope.contentVersion,
        targetId,
        targetId === null,
      ),
    {
      initialProps: {
        connectedPlayer: suppliedPlayer ?? (player as AudioPlayer),
      },
      wrapper: ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      ),
    },
  )
  return { store, player, publishSnapshot, ...hook }
}

describe('Reader audio Redux control', () => {
  it('retains a controller failure with the applied Play identity', async () => {
    const media = document.createElement('audio')
    media.pause = vi.fn()
    const player = createReaderAudioController(media, {
      readTarget: async () => {
        throw new Error('Narration unavailable')
      },
      readFileSegments: async () => [],
      follow: vi.fn(),
    })
    const { store } = renderControl(player)

    await act(async () => {
      store.dispatch(
        setReaderAudioPlayback({ ...scope, isPlaying: true, segmentId: 2 }),
      )
    })

    expect(getReaderAudioObservation(store.getState())).toMatchObject({
      status: 'error',
      error: 'Narration unavailable',
      isPlaying: false,
      requestId: getReaderAudioPlaybackRequest(store.getState())!.requestId,
    })
    expect(store.getState().reader.selectedSegmentId).toBe(2)
  })

  it('keeps Pause when cancelled preparation fails late', async () => {
    const media = document.createElement('audio')
    media.pause = vi.fn()
    let rejectTarget!: (error: Error) => void
    const player = createReaderAudioController(media, {
      readTarget: () =>
        new Promise((_resolve, reject) => {
          rejectTarget = reject
        }),
      readFileSegments: async () => [],
      follow: vi.fn(),
    })
    const { store } = renderControl(player)
    act(() =>
      store.dispatch(
        setReaderAudioPlayback({ ...scope, isPlaying: true, segmentId: 2 }),
      ),
    )

    await act(async () => {
      store.dispatch(setReaderAudioPlayback({ ...scope, isPlaying: false }))
      rejectTarget(new Error('Late failure'))
    })

    expect(getReaderAudioObservation(store.getState())).toMatchObject({
      status: 'paused',
      error: null,
      isPlaying: false,
      requestId: getReaderAudioPlaybackRequest(store.getState())!.requestId,
    })
  })

  it('reports every controller transition before React renders', () => {
    const { store, publishSnapshot } = renderControl()
    const statuses: string[] = []
    const unsubscribe = store.subscribe(() => {
      statuses.push(getReaderAudioObservation(store.getState())!.status)
    })
    const segment = {
      id: 2,
      sequence: 2,
      section_id: 1,
      root_section_id: 1,
      narration_start_ms: 0,
      narration_end_ms: 1000,
      narration_seek_ms: null,
    }

    act(() => {
      publishSnapshot({
        ...idleReaderAudioSnapshot,
        status: 'buffering',
        isPlaying: true,
      })
      publishSnapshot({
        ...idleReaderAudioSnapshot,
        status: 'playing',
        isPlaying: true,
        segment,
        speakingSegmentId: 2,
      })
      publishSnapshot({
        ...idleReaderAudioSnapshot,
        status: 'error',
        segment,
        error: 'Play was denied',
      })
    })

    expect(statuses).toEqual(['buffering', 'playing', 'error'])
    expect(getReaderAudioObservation(store.getState())).toMatchObject({
      segment,
      speakingSegmentId: null,
      status: 'error',
      error: 'Play was denied',
      isPlaying: false,
    })
    unsubscribe()
  })

  it('ignores a report from an older applied request', () => {
    const { store } = renderControl()
    act(() =>
      store.dispatch(
        setReaderAudioPlayback({ ...scope, isPlaying: true, segmentId: 2 }),
      ),
    )
    const oldReport = getReaderAudioObservation(store.getState())!

    act(() => {
      store.dispatch(setReaderAudioPlayback({ ...scope, isPlaying: false }))
      store.dispatch(reportReaderAudio({ ...oldReport, status: 'playing' }))
    })

    expect(getReaderAudioObservation(store.getState())).toMatchObject({
      status: 'paused',
      requestId: getReaderAudioPlaybackRequest(store.getState())!.requestId,
    })
  })

  it('updates request identity when Play needs no controller transition', () => {
    const { store, player, publishSnapshot } = renderControl(undefined, 2)
    act(() =>
      publishSnapshot({
        ...idleReaderAudioSnapshot,
        status: 'playing',
        isPlaying: true,
      }),
    )

    act(() =>
      store.dispatch(setReaderAudioPlayback({ ...scope, isPlaying: true })),
    )

    expect(player.playFromSegment).not.toHaveBeenCalled()
    expect(getReaderAudioObservation(store.getState())).toMatchObject({
      status: 'playing',
      requestId: getReaderAudioPlaybackRequest(store.getState())!.requestId,
    })
  })

  it('replaces controller ownership and ignores old reports and disposal', () => {
    const { store, player, rerender } = renderControl()
    const oldReport = getReaderAudioObservation(store.getState())!

    rerender({ connectedPlayer: { ...player } })
    const replacement = getReaderAudioObservation(store.getState())!
    act(() => {
      store.dispatch(
        reportReaderAudio({
          ...oldReport,
          status: 'error',
          error: 'Old failure',
        }),
      )
      store.dispatch(clearReaderAudioObservation(oldReport))
    })

    expect(replacement.controllerId).not.toBe(oldReport.controllerId)
    expect(getReaderAudioObservation(store.getState())).toEqual(replacement)
  })

  it('clears its observation and unsubscribes on disposal', () => {
    const { store, publishSnapshot, unmount } = renderControl()

    unmount()
    act(() =>
      publishSnapshot({
        ...idleReaderAudioSnapshot,
        status: 'error',
        error: 'Late failure',
      }),
    )

    expect(getReaderAudioObservation(store.getState())).toBeNull()
  })

  it.each([{ bookId: 8 }, { contentVersion: 'old' }])(
    'ignores a report for another scope: %o',
    (changedScope) => {
      const { store } = renderControl()
      const observation = getReaderAudioObservation(store.getState())!

      act(() =>
        store.dispatch(
          reportReaderAudio({
            ...observation,
            ...changedScope,
            status: 'error',
          }),
        ),
      )

      expect(getReaderAudioObservation(store.getState())).toEqual(observation)
    },
  )

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
    expect(getReaderAudioObservation(store.getState())).toMatchObject({
      ...scope,
      requestId: getReaderAudioPlaybackRequest(store.getState())?.requestId,
      isPlaying: true,
      status: 'preparing',
    })
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
      expect(getReaderAudioObservation(store.getState())).toMatchObject({
        isPlaying: false,
        status: 'paused',
      })
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
    expect(getReaderAudioObservation(store.getState())).toBeNull()
  })
})
