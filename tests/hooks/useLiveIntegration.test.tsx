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
  const snapshot: ReturnType<
    ReturnType<typeof createLiveConversation>['getSnapshot']
  > = { status: 'idle', error: null, canContinue: false }
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
  return { events, live, snapshot, unmount: view.unmount }
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
      const { events, snapshot } = renderIntegration()
      snapshot.status = status

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
  ])('ignores modified or composing Live keys %j', (flags) => {
    const { events } = renderIntegration()

    fireEvent.keyDown(window, { key: 'MediaPlay', ...flags })

    expect(events).toEqual([])
  })

  it.each(['button', 'input', 'textarea', 'select', 'a', 'summary'])(
    'preserves Live input on %s',
    (tag) => {
      const { events } = renderIntegration()
      const element = document.createElement(tag)
      document.body.append(element)

      fireEvent.keyDown(element, { key: 'MediaPlay' })
      element.remove()

      expect(events).toEqual([])
    },
  )

  it('preserves native selection and leaves reader keys to the reader', () => {
    const { events } = renderIntegration()
    vi.spyOn(document, 'getSelection').mockReturnValue({
      isCollapsed: false,
    } as Selection)

    expect(fireEvent.keyDown(window, { key: 'MediaPlay' })).toBe(true)
    expect(events).toEqual([])

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
