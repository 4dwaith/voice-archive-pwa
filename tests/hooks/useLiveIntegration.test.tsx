// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { LiveButton } from '../../src/components/atoms/LiveButton/LiveButton'
import { LiveProvider } from '../../src/contexts/LiveProvider'
import { createLiveConversation } from '../../src/services/liveConversation'
import { useReaderAudioControl } from '../../src/hooks/useReaderAudioControl'
import { createAppStore } from '../../src/store/store'
import { openReader } from '../../src/store/readerSlice'
import { setReaderAudioPlayback } from '../../src/store/readerAudioSlice'
import { idleReaderAudioSnapshot } from '../../src/services/readerAudioController'

vi.mock('../../src/services/liveConversation', () => ({
  createLiveConversation: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const scope = { bookId: 7, contentVersion: 'version' }

function renderIntegration() {
  const store = createAppStore()
  const events: string[] = []
  const live = {
    start: vi.fn(async () => {
      events.push('start live')
    }),
    stop: vi.fn(() => {
      events.push('stop live')
    }),
    discard: vi.fn(),
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  }
  const snapshot = { status: 'idle' as const, error: null, canContinue: false }
  vi.mocked(createLiveConversation).mockReturnValue(live)
  let playback = idleReaderAudioSnapshot
  const player = {
    getSnapshot: () => playback,
    playFromSegment: vi.fn(() => {
      playback = {
        ...idleReaderAudioSnapshot,
        status: 'preparing',
        isPlaying: true,
      }
      events.push('play narration')
    }),
    pausePlayback: vi.fn(() => {
      playback = { ...idleReaderAudioSnapshot, status: 'paused' }
      events.push('pause narration')
    }),
    selectSegment: vi.fn(),
    seekBySeconds: vi.fn(async () => {}),
  }

  function ReaderControl() {
    useReaderAudioControl(player, scope.bookId, scope.contentVersion, 1, false)
    return (
      <button
        onClick={() =>
          store.dispatch(setReaderAudioPlayback({ ...scope, isPlaying: true }))
        }
      >
        Play
      </button>
    )
  }

  render(
    <Provider store={store}>
      <MemoryRouter>
        <LiveProvider>
          <LiveButton />
          <Routes>
            <Route
              path="/"
              element={
                <Link
                  to="/books/7"
                  onClick={() => store.dispatch(openReader(scope))}
                >
                  Open book
                </Link>
              }
            />
            <Route path="/books/7" element={<ReaderControl />} />
          </Routes>
        </LiveProvider>
      </MemoryRouter>
    </Provider>,
  )
  return { events, live }
}

describe('Live reader integration', () => {
  it('retains Live across route changes and stops it before narration', () => {
    const { events, live } = renderIntegration()

    fireEvent.click(screen.getByRole('button', { name: 'Start Live' }))

    fireEvent.click(screen.getByRole('link', { name: 'Open book' }))

    expect(live.stop).not.toHaveBeenCalled()
    expect(createLiveConversation).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    expect(events).toEqual(['start live', 'stop live', 'play narration'])
  })

  it('cancels narration before starting capture', () => {
    const { events } = renderIntegration()

    fireEvent.click(screen.getByRole('link', { name: 'Open book' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    events.length = 0

    fireEvent.click(screen.getByRole('button', { name: 'Start Live' }))

    expect(events).toEqual(['pause narration', 'start live'])
  })
})
