// @vitest-environment jsdom
import '../helpers/database'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  let notifyLive = () => {}
  let notifyAudio = () => {}
  const live = {
    start: vi.fn(async () => {
      events.push('start live')
      snapshot.status = 'connected'
      notifyLive()
    }),
    stop: vi.fn(() => {
      events.push('stop live')
      snapshot.status = 'idle'
      notifyLive()
    }),
    discard: vi.fn(),
    quiesceAudio: vi.fn(() => events.push('mute live')),
    resumeAudio: vi.fn(),
    getSnapshot: () => snapshot,
    subscribe: (notify: () => void) => {
      notifyLive = notify
      return () => {}
    },
  }
  const snapshot: ReturnType<
    ReturnType<typeof createLiveConversation>['getSnapshot']
  > = { status: 'idle', error: null, canContinue: false }
  vi.mocked(createLiveConversation).mockReturnValue(live)
  let playback = idleReaderAudioSnapshot
  const player = {
    subscribe: (notify: () => void) => {
      notifyAudio = notify
      return () => {}
    },
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

  const view = render(
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
  return {
    events,
    live,
    snapshot,
    notifyLive: () => act(notifyLive),
    reportAudio: (status: 'playing' | 'error') =>
      act(() => {
        playback = {
          ...playback,
          status,
          isPlaying: status === 'playing',
          error: status === 'error' ? 'Media rejected' : null,
        }
        notifyAudio()
      }),
    unmount: view.unmount,
  }
}

describe('Live reader integration', () => {
  it('starts Live once per media key press and removes the listener on exit', () => {
    const { events, unmount } = renderIntegration()

    fireEvent.keyDown(window, { key: 'MediaPlay' })
    fireEvent.keyDown(window, { key: 'MediaPlay', repeat: true })
    fireEvent.keyUp(window, { key: 'MediaPlay' })

    expect(events).toEqual(['start live'])

    unmount()
    events.length = 0
    fireEvent.keyDown(window, { key: 'MediaPlay' })

    expect(events).toEqual([])
  })

  it.each(['connecting', 'connected'] as const)(
    'stops Live while %s',
    (status) => {
      const { events, snapshot, notifyLive } = renderIntegration()
      snapshot.status = status
      notifyLive()

      fireEvent.keyDown(window, { key: 'MediaPlay' })

      expect(events).toEqual(['stop live'])
    },
  )

  it.each([
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { isComposing: true },
  ])('handles Live keys regardless of modifier flags %j', (flags) => {
    const { events } = renderIntegration()

    fireEvent.keyDown(window, { key: 'MediaPlay', ...flags })

    expect(events).toEqual(['start live'])
  })

  it.each(['button', 'input', 'textarea', 'select', 'a', 'summary'])(
    'handles Live keys with focus on %s',
    (tag) => {
      const { events } = renderIntegration()
      const element = document.createElement(tag)
      document.body.append(element)
      element.tabIndex = 0
      element.focus()

      fireEvent.keyDown(element, { key: 'MediaPlay' })
      element.remove()

      expect(events).toEqual(['start live'])
    },
  )

  it('handles Live with selected text and leaves other keys alone', () => {
    const { events } = renderIntegration()
    vi.spyOn(document, 'getSelection').mockReturnValue({
      isCollapsed: false,
    } as Selection)

    expect(fireEvent.keyDown(window, { key: 'MediaPlay' })).toBe(false)
    expect(events).toEqual(['start live'])

    vi.mocked(document.getSelection).mockRestore()

    for (const key of [
      'PageUp',
      'PageDown',
      'Unidentified',
      'MediaTrackPrevious',
      'MediaTrackNext',
    ])
      expect(fireEvent.keyDown(window, { key })).toBe(true)
  })

  it('retains Live while preparing and closes quietly on playing', () => {
    const { events, live, reportAudio } = renderIntegration()

    fireEvent.click(screen.getByRole('button', { name: 'Start Live' }))

    fireEvent.click(screen.getByRole('link', { name: 'Open book' }))

    expect(live.stop).not.toHaveBeenCalled()
    expect(createLiveConversation).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    expect(events).toEqual(['start live', 'mute live', 'play narration'])
    expect(live.stop).not.toHaveBeenCalled()

    reportAudio('playing')

    expect(live.stop).toHaveBeenCalledOnce()
  })

  it.each([false, true])(
    'forwards a new failure once unless explicitly stopped (%s)',
    (isStopped) => {
      const { live, reportAudio } = renderIntegration()

      fireEvent.click(screen.getByRole('button', { name: 'Start Live' }))
      fireEvent.click(screen.getByRole('link', { name: 'Open book' }))
      fireEvent.click(screen.getByRole('button', { name: 'Play' }))

      if (isStopped) {
        fireEvent.click(screen.getByRole('button', { name: 'Stop Live' }))
        fireEvent.click(screen.getByRole('button', { name: 'Start Live' }))
      }
      reportAudio('error')
      reportAudio('error')

      expect(live.resumeAudio.mock.calls).toEqual(
        isStopped ? [] : [['Media rejected']],
      )
    },
  )

  it('cancels narration before starting capture', () => {
    const { events } = renderIntegration()

    fireEvent.click(screen.getByRole('link', { name: 'Open book' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    events.length = 0

    fireEvent.click(screen.getByRole('button', { name: 'Start Live' }))

    expect(events).toEqual(['pause narration', 'start live'])
  })
})
