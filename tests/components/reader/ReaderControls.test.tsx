// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderControls } from '../../../src/components/molecules/ReaderControls/ReaderControls'
import { ReaderPdfBoundary } from '../../../src/components/molecules/ReaderPdf/ReaderPdfBoundary'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.getSelection()?.removeAllRanges()
})

function createContextValue(): ReaderContextValue {
  return {
    toc: {
      selectedSectionId: null,
      isSectionExpanded: () => true,
      tocPresentation: 'shown',
      selectSection: vi.fn(),
      setSectionExpanded: vi.fn(),
      setTocPresentation: vi.fn(),
    },
    navigation: {
      pageScope: 'local',
      setPageScope: () => undefined,
      globalPage: null,
      totalPageCount: null,
      indexedPageCount: 0,
      isPageNavigationPending: false,
      requestPageNavigation: vi.fn(),
      currentPage: 1,
      pageCount: 10,
      setCurrentPage: vi.fn(),
      reportPageMeasurement: () => undefined,
    },
    reader: {
      areControlsVisible: true,
      setControlsVisible: vi.fn(),
      textSizePercent: 100,
      selectedSegmentId: null,
      highlightedSegmentId: null,
      selectSegment: vi.fn(),
      reportLayoutKey: () => undefined,
      reportSegmentError: vi.fn(),
    },
  }
}

function renderControls(
  isVisible = true,
  mode?: 'text' | 'pdf',
  isPlaying?: boolean,
  content?: ReactNode,
) {
  const context = createContextValue()
  context.reader.areControlsVisible = isVisible
  if (isPlaying !== undefined)
    context.reader.audio = {
      isPlaying,
      status: isPlaying ? 'playing' : 'paused',
      error: null,
      canPlay: true,
      segment: null,
      isSegmentSplit: false,
      togglePlayback: vi.fn(),
      pausePlayback: vi.fn(),
      seekBySeconds: vi.fn(),
      readProgress: () => 0,
    }
  if (mode)
    context.reader.pdf = {
      url: null,
      regions: [],
      viewMode: mode,
      setViewMode: vi.fn(),
    }
  const show = () => (
    <ReaderContext value={context}>
      <ReaderControls controls={<button>Home</button>}>
        {content ?? (
          <>
            <p tabIndex={0}>Book content</p>
            <button>Content action</button>
          </>
        )}
      </ReaderControls>
    </ReaderContext>
  )
  const view = render(show())

  return { context, update: () => view.rerender(show()), unmount: view.unmount }
}

function dispatchPointer(
  element: Element,
  type: string,
  clientX = 0,
  {
    y = 0,
    pointerType = 'mouse',
    isPrimary = true,
    timeStamp,
  }: {
    y?: number
    pointerType?: string
    isPrimary?: boolean
    timeStamp?: number
  } = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY: y,
  })
  Object.defineProperties(event, {
    isPrimary: { value: isPrimary },
    pointerType: { value: pointerType },
    pointerId: { value: 1 },
  })
  if (timeStamp !== undefined)
    Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  fireEvent(element, event)
}

function dispatchTouches(
  element: Element,
  type: string,
  points: number[][],
  timeStamp?: number,
  canCancel = true,
) {
  const event = new Event(type, { bubbles: true, cancelable: canCancel })
  const touches = points.map(([clientX, clientY], index) => ({
    identifier: index + 1,
    clientX,
    clientY,
    target: element,
  }))
  Object.defineProperties(event, {
    touches: { value: touches },
    targetTouches: { value: touches },
    changedTouches: {
      value: touches.length ? touches : [{ identifier: 1, target: element }],
    },
  })
  if (timeStamp !== undefined)
    Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  fireEvent(element, event)
  return event
}

describe('ReaderControls', () => {
  describe('page-turner media keys', () => {
    it('handles navigation and toggles from the narration portal once', () => {
      const { context } = renderControls(
        false,
        'text',
        true,
        createPortal(
          <div data-reader-narration>Modal text</div>,
          document.body,
        ),
      )
      const target = screen.getByText('Modal text')

      for (const key of [
        'PageDown',
        'PageUp',
        'MediaTrackPrevious',
        'MediaTrackNext',
      ]) {
        fireEvent.keyDown(target, { key })
        fireEvent.keyDown(target, { key, repeat: true })
        fireEvent.keyUp(target, { key })
      }

      expect(context.reader.audio?.seekBySeconds).toHaveBeenNthCalledWith(1, 5)
      expect(context.reader.audio?.seekBySeconds).toHaveBeenNthCalledWith(2, -5)
      expect(context.reader.audio?.seekBySeconds).toHaveBeenCalledTimes(2)
      expect(context.reader.audio?.togglePlayback).toHaveBeenCalledTimes(1)
      expect(context.reader.pdf?.setViewMode).toHaveBeenCalledExactlyOnceWith(
        'pdf',
      )
      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    })

    it('toggles narration and mode once without revealing controls', () => {
      const { context } = renderControls(false, 'text', false)

      for (const key of ['MediaTrackPrevious', 'MediaTrackNext']) {
        fireEvent.keyDown(screen.getByText('Book content'), { key })
        fireEvent.keyDown(screen.getByText('Book content'), {
          key,
          repeat: true,
        })
        fireEvent.keyUp(screen.getByText('Book content'), { key })
      }

      expect(context.reader.audio?.togglePlayback).toHaveBeenCalledTimes(1)
      expect(context.reader.pdf?.setViewMode).toHaveBeenCalledExactlyOnceWith(
        'pdf',
      )
      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    })

    it('leaves PDF narration unavailable and switches back to Text', () => {
      const { context } = renderControls(true, 'pdf', false)

      fireEvent.keyDown(screen.getByText('Book content'), {
        key: 'MediaTrackPrevious',
      })
      fireEvent.keyDown(screen.getByText('Book content'), {
        key: 'MediaTrackNext',
      })

      expect(context.reader.audio?.togglePlayback).not.toHaveBeenCalled()
      expect(context.reader.pdf?.setViewMode).toHaveBeenCalledExactlyOnceWith(
        'text',
      )
    })

    it('does not start unavailable narration', () => {
      const { context } = renderControls(true, 'text', false)
      context.reader.audio!.canPlay = false

      fireEvent.keyDown(screen.getByText('Book content'), {
        key: 'MediaTrackPrevious',
      })

      expect(context.reader.audio?.togglePlayback).not.toHaveBeenCalled()
    })

    it('releases the reader keys on exit', () => {
      const { context, unmount } = renderControls(true, 'text', false)

      unmount()
      expect(fireEvent.keyDown(window, { key: 'MediaTrackPrevious' })).toBe(
        true,
      )
      expect(fireEvent.keyDown(window, { key: 'MediaTrackNext' })).toBe(true)

      expect(context.reader.audio?.togglePlayback).not.toHaveBeenCalled()
      expect(context.reader.pdf?.setViewMode).not.toHaveBeenCalled()
    })

    it('preserves focused controls and composing input', () => {
      const { context } = renderControls(true, 'text', false)

      fireEvent.keyDown(screen.getByRole('button', { name: 'Home' }), {
        key: 'MediaTrackPrevious',
      })
      fireEvent.keyDown(screen.getByText('Book content'), {
        key: 'MediaTrackNext',
        isComposing: true,
      })

      expect(context.reader.audio?.togglePlayback).not.toHaveBeenCalled()
      expect(context.reader.pdf?.setViewMode).not.toHaveBeenCalled()
    })
  })

  it.each([true, false])(
    'preserves controls at %s when returning focus from PDF',
    (isVisible) => {
      const { context, update } = renderControls(isVisible, 'pdf')
      act(() => screen.getByRole('button', { name: 'Content action' }).focus())
      vi.mocked(context.reader.setControlsVisible).mockClear()

      context.reader.pdf!.viewMode = 'text'
      update()

      expect(screen.getByRole('region', { name: 'Reader' })).toHaveFocus()
      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    },
  )

  it('keeps a text escape available after PDF initialization fails', () => {
    const context = createContextValue()
    context.reader.pdf = {
      url: null,
      regions: [],
      viewMode: 'pdf',
      setViewMode: vi.fn(),
    }
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    function ThrowPdfError(): never {
      throw new ReferenceError('Iterator is not defined')
    }

    try {
      render(
        <ReaderContext value={context}>
          <ReaderControls>
            <ReaderPdfBoundary>
              <ThrowPdfError />
            </ReaderPdfBoundary>
          </ReaderControls>
        </ReaderContext>,
      )

      expect(screen.getByRole('alert')).toHaveTextContent('could not be opened')

      fireEvent.click(screen.getByRole('button', { name: 'Switch to Text' }))

      expect(context.reader.pdf.setViewMode).toHaveBeenCalledExactlyOnceWith(
        'text',
      )
    } finally {
      logError.mockRestore()
    }
  })

  describe('mode gestures', () => {
    it('claims the first small horizontal move before switching modes', () => {
      const { context } = renderControls(false, 'text')
      const content = screen.getByText('Book content')

      dispatchTouches(content, 'touchstart', [
        [200, 100],
        [300, 100],
      ])
      const firstMove = dispatchTouches(content, 'touchmove', [
        [199, 100],
        [299, 100],
      ])

      expect(firstMove.defaultPrevented).toBe(true)
      expect(context.reader.pdf!.setViewMode).not.toHaveBeenCalled()

      dispatchTouches(content, 'touchmove', [
        [100, 100],
        [200, 100],
      ])
      dispatchTouches(content, 'touchend', [])

      expect(context.reader.pdf!.setViewMode).toHaveBeenCalledExactlyOnceWith(
        'pdf',
      )
      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('accepts a slower swipe with modest finger spacing changes', () => {
      const { context } = renderControls(false, 'text')
      const content = screen.getByText('Book content')

      dispatchTouches(
        content,
        'touchstart',
        [
          [200, 100],
          [300, 100],
        ],
        100,
      )
      dispatchTouches(
        content,
        'touchmove',
        [
          [100, 100],
          [210, 100],
        ],
        1100,
      )
      dispatchTouches(content, 'touchend', [], 1200, false)

      expect(context.reader.pdf!.setViewMode).toHaveBeenCalledExactlyOnceWith(
        'pdf',
      )
      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('leaves gestures already claimed by the browser alone', () => {
      const { context } = renderControls(false, 'pdf')
      const content = screen.getByText('Book content')

      dispatchTouches(content, 'touchstart', [
        [200, 100],
        [300, 100],
      ])
      const movement = new Event('touchmove', {
        bubbles: true,
        cancelable: false,
      })
      const touches = [100, 200].map((clientX, index) => ({
        identifier: index + 1,
        clientX,
        clientY: 100,
        target: content,
      }))
      Object.defineProperties(movement, {
        touches: { value: touches },
        targetTouches: { value: touches },
        changedTouches: { value: touches },
      })
      fireEvent(content, movement)
      dispatchTouches(content, 'touchend', [])

      expect(context.reader.pdf!.setViewMode).not.toHaveBeenCalled()
    })

    it.each([
      { mode: 'text' as const, dx: -100, destination: 'pdf' },
      { mode: 'pdf' as const, dx: 100, destination: 'text' },
    ])('switches $mode once without paging', ({ mode, dx, destination }) => {
      const { context } = renderControls(false, mode)
      const content = screen.getByText('Book content')
      dispatchPointer(content, 'pointerdown', 0, { pointerType: 'touch' })
      dispatchPointer(content, 'pointerdown', 100, {
        pointerType: 'touch',
        isPrimary: false,
      })

      dispatchTouches(content, 'touchstart', [
        [200, 100],
        [300, 100],
      ])
      const movement = dispatchTouches(content, 'touchmove', [
        [200 + dx, 100],
        [300 + dx, 100],
      ])
      dispatchTouches(content, 'touchend', [[200 + dx, 100]])
      dispatchTouches(content, 'touchend', [])
      dispatchPointer(content, 'pointerup', dx, { pointerType: 'touch' })
      fireEvent.click(content)

      expect(movement.defaultPrevented).toBe(true)
      expect(context.reader.pdf!.setViewMode).toHaveBeenCalledExactlyOnceWith(
        destination,
      )
      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    })

    it.each([
      {
        name: 'pinch',
        points: [
          [150, 100],
          [350, 100],
        ],
      },
      {
        name: 'vertical movement',
        points: [
          [200, 200],
          [300, 200],
        ],
      },
      {
        name: 'diagonal movement',
        points: [
          [300, 200],
          [400, 200],
        ],
      },
      {
        name: 'short movement',
        points: [
          [210, 100],
          [310, 100],
        ],
      },
      { name: 'one finger', points: [[100, 100]] },
      {
        name: 'extra fingers',
        points: [
          [100, 100],
          [200, 100],
          [300, 100],
        ],
      },
    ])('ignores $name', ({ points }) => {
      const { context } = renderControls(false, 'text')
      const content = screen.getByText('Book content')

      dispatchTouches(content, 'touchstart', [
        [200, 100],
        [300, 100],
      ])
      dispatchTouches(content, 'touchmove', points)
      dispatchTouches(content, 'touchend', [])

      expect(context.reader.pdf!.setViewMode).not.toHaveBeenCalled()
    })

    it('leaves pinch events uncancelled', () => {
      renderControls(false, 'text')
      const content = screen.getByText('Book content')

      dispatchTouches(content, 'touchstart', [
        [200, 100],
        [300, 100],
      ])
      const movement = dispatchTouches(content, 'touchmove', [
        [150, 100],
        [350, 100],
      ])

      expect(movement.defaultPrevented).toBe(false)
    })

    it('abandons cancelled touches', () => {
      const { context } = renderControls(false, 'text')
      const content = screen.getByText('Book content')

      dispatchTouches(content, 'touchstart', [
        [200, 100],
        [300, 100],
      ])
      dispatchTouches(content, 'touchmove', [
        [100, 100],
        [200, 100],
      ])
      dispatchTouches(content, 'touchcancel', [])
      dispatchTouches(content, 'touchend', [])

      expect(context.reader.pdf!.setViewMode).not.toHaveBeenCalled()
    })

    it('ignores controls', () => {
      const { context } = renderControls(true, 'text')
      const button = screen.getByRole('button', { name: 'Home' })

      dispatchTouches(button, 'touchstart', [
        [200, 100],
        [300, 100],
      ])
      dispatchTouches(button, 'touchmove', [
        [100, 100],
        [200, 100],
      ])
      dispatchTouches(button, 'touchend', [])

      expect(context.reader.pdf!.setViewMode).not.toHaveBeenCalled()
    })

    it('leaves PDF single-finger scrolling and page keys alone', () => {
      const { context } = renderControls(false, 'pdf')
      const content = screen.getByText('Book content')

      dispatchTouches(content, 'touchstart', [[200, 100]])
      const movement = dispatchTouches(content, 'touchmove', [[100, 100]])
      dispatchTouches(content, 'touchend', [])
      const isUncancelled = fireEvent.keyDown(content, { key: 'PageDown' })

      expect(isUncancelled).toBe(true)
      expect(movement.defaultPrevented).toBe(false)
      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })
  })

  it.each([true, false])(
    'toggles a deliberate content tap from %s',
    (isVisible) => {
      const { context } = renderControls(isVisible)
      const text = screen.getByText('Book content')

      dispatchPointer(text, 'pointerdown')
      fireEvent.click(text)

      expect(context.reader.setControlsVisible).toHaveBeenCalledExactlyOnceWith(
        !isVisible,
      )
    },
  )

  it('waits for a possible double tap before toggling on a segment', () => {
    vi.useFakeTimers()
    const { context } = renderControls()
    const text = screen.getByText('Book content')
    text.setAttribute('data-reader-segment-id', '1')
    text.setAttribute('data-reader-mappable', 'true')

    dispatchPointer(text, 'pointerdown')
    fireEvent.click(text)

    expect(context.reader.setControlsVisible).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(350))

    expect(context.reader.setControlsVisible).toHaveBeenCalledExactlyOnceWith(
      false,
    )
  })

  it.each([true, false])(
    'keeps controls at %s when a segment is selected',
    (isVisible) => {
      vi.useFakeTimers()
      const { context, update } = renderControls(isVisible)
      const text = screen.getByText('Book content')
      text.setAttribute('data-reader-segment-id', '1')
      text.setAttribute('data-reader-mappable', 'true')

      dispatchPointer(text, 'pointerdown')
      fireEvent.click(text)
      context.reader.selectedSegmentId = 1
      update()
      act(() => vi.advanceTimersByTime(350))

      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    },
  )

  it.each(['drag', 'cancel', 'selection', 'existing selection'])(
    'ignores %s',
    (gesture) => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')
      const selectText = () => {
        const range = document.createRange()
        range.selectNodeContents(text)
        window.getSelection()?.addRange(range)
      }
      if (gesture === 'existing selection') selectText()

      dispatchPointer(text, 'pointerdown')
      if (gesture === 'drag') {
        dispatchPointer(text, 'pointermove', 12)
        dispatchPointer(text, 'pointermove', 0)
      }
      if (gesture === 'cancel') dispatchPointer(text, 'pointercancel')
      if (gesture === 'selection') selectText()
      if (gesture === 'existing selection')
        window.getSelection()?.removeAllRanges()
      fireEvent.click(text)

      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    },
  )

  it('ignores content and header controls', async () => {
    const { context } = renderControls()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Content action' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))

    expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
  })

  it('keeps touch focus from revealing controls before the tap toggle', () => {
    vi.useFakeTimers()
    const { context } = renderControls(false)
    const text = screen.getByText('Book content')
    text.setAttribute('data-reader-segment-id', '1')
    text.setAttribute('data-reader-mappable', 'true')

    dispatchPointer(text, 'pointerdown', 0, { pointerType: 'touch' })
    dispatchPointer(text, 'pointerup', 0, { pointerType: 'touch' })
    fireEvent.focusIn(text)

    expect(context.reader.setControlsVisible).not.toHaveBeenCalled()

    fireEvent.click(text)
    act(() => vi.advanceTimersByTime(350))

    expect(context.reader.setControlsVisible).toHaveBeenCalledExactlyOnceWith(
      true,
    )
  })

  it('reveals on keyboard focus', async () => {
    const { context } = renderControls(false)
    const user = userEvent.setup()

    await user.tab()

    expect(screen.getByRole('region', { name: 'Reader' })).toHaveFocus()
    expect(context.reader.setControlsVisible).toHaveBeenCalledWith(true)
  })

  it('reveals on a key while text is focused', () => {
    const { context } = renderControls(false)
    const text = screen.getByText('Book content')
    act(() => text.focus())
    vi.mocked(context.reader.setControlsVisible).mockClear()

    fireEvent.keyDown(text, { key: 'a' })

    expect(context.reader.setControlsVisible).toHaveBeenCalledExactlyOnceWith(
      true,
    )
  })

  it('returns collapsed header focus to the reader', () => {
    const { context, update } = renderControls()
    act(() => screen.getByRole('button', { name: 'Home' }).focus())
    vi.mocked(context.reader.setControlsVisible).mockClear()

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

    expect(context.reader.setControlsVisible).toHaveBeenCalledExactlyOnceWith(
      false,
    )

    context.reader.areControlsVisible = false
    update()

    expect(
      screen.queryByRole('button', { name: 'Home' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Reader' })).toHaveFocus()
    expect(context.reader.setControlsVisible).toHaveBeenCalledTimes(1)
  })

  it('has no controls toggle button', () => {
    renderControls(false)

    expect(
      screen.queryByRole('button', { name: /reader controls/ }),
    ).not.toBeInTheDocument()
  })

  describe('page gestures', () => {
    it.each([-1, 1])('seeks %i audio steps while playing', (direction) => {
      const { context } = renderControls(false, undefined, true)
      const text = screen.getByText('Book content')

      dispatchTouches(text, 'touchstart', [[200, 200]])
      dispatchTouches(text, 'touchmove', [[200 - direction * 100, 200]])
      dispatchTouches(text, 'touchend', [])

      expect(
        context.reader.audio!.seekBySeconds,
      ).toHaveBeenCalledExactlyOnceWith(direction * 5)
      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('accepts a slower deliberate swipe', () => {
      const { context } = renderControls(false)
      const text = screen.getByText('Book content')

      dispatchTouches(text, 'touchstart', [[200, 200]], 100)
      dispatchTouches(text, 'touchmove', [[100, 200]], 1100)
      dispatchTouches(text, 'touchend', [], 1200)

      expect(
        context.navigation.requestPageNavigation,
      ).toHaveBeenCalledExactlyOnceWith({
        scope: 'local',
        kind: 'relative',
        delta: 1,
      })
    })

    it.each([
      [-100, 0, 1],
      [0, -100, 1],
      [100, 0, -1],
      [0, 100, -1],
    ])('maps a swipe of %i,%i to direction %i', (dx, dy, delta) => {
      const { context } = renderControls(false)
      const text = screen.getByText('Book content')

      dispatchTouches(text, 'touchstart', [[200, 200]])
      dispatchTouches(text, 'touchmove', [[200 + dx, 200 + dy]])
      dispatchTouches(text, 'touchend', [])
      fireEvent.click(text)

      expect(
        context.navigation.requestPageNavigation,
      ).toHaveBeenCalledExactlyOnceWith({
        scope: 'local',
        kind: 'relative',
        delta,
      })
      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    })

    it.each([
      {
        name: 'a short drag',
        dx: 20,
        dy: 0,
        pointerType: 'touch',
        duration: 100,
      },
      {
        name: 'a diagonal drag',
        dx: 100,
        dy: 100,
        pointerType: 'touch',
        duration: 100,
      },
      {
        name: 'a mouse drag',
        dx: 100,
        dy: 0,
        pointerType: 'mouse',
        duration: 100,
      },
    ])('ignores $name', ({ dx, dy, pointerType, duration }) => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')

      if (pointerType === 'touch') {
        dispatchTouches(text, 'touchstart', [[200, 200]])
        dispatchTouches(text, 'touchmove', [[200 + dx, 200 + dy]])
        dispatchTouches(text, 'touchend', [])
      } else {
        dispatchPointer(text, 'pointerdown', 0, { pointerType, timeStamp: 100 })
        dispatchPointer(text, 'pointerup', dx, {
          pointerType,
          y: dy,
          timeStamp: 100 + duration,
        })
      }

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('ignores multitouch', () => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')

      dispatchTouches(text, 'touchstart', [[200, 200]])
      dispatchTouches(text, 'touchstart', [
        [200, 200],
        [300, 200],
      ])
      dispatchTouches(text, 'touchmove', [
        [100, 200],
        [200, 200],
      ])
      dispatchTouches(text, 'touchend', [])

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('ignores a cancelled touch', () => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')

      dispatchTouches(text, 'touchstart', [[200, 200]])
      dispatchTouches(text, 'touchmove', [[100, 200]])
      dispatchTouches(text, 'touchcancel', [])

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it.each(['Home', 'Content action'])('ignores a swipe on %s', (name) => {
      const { context } = renderControls()
      const button = screen.getByRole('button', { name })

      dispatchTouches(button, 'touchstart', [[200, 200]])
      dispatchTouches(button, 'touchmove', [[100, 200]])
      dispatchTouches(button, 'touchend', [])

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('leaves native text selection alone', () => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')
      const range = document.createRange()
      range.selectNodeContents(text)
      window.getSelection()?.addRange(range)

      dispatchTouches(text, 'touchstart', [[200, 200]])
      dispatchTouches(text, 'touchmove', [[100, 200]])
      dispatchTouches(text, 'touchend', [])

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })
  })

  describe('keyboard paging', () => {
    it.each([
      ['PageDown', 5],
      ['PageUp', -5],
    ])('seeks audio with %s while playing', (key, seconds) => {
      const { context } = renderControls(false, undefined, true)

      fireEvent.keyDown(screen.getByText('Book content'), { key })

      expect(
        context.reader.audio!.seekBySeconds,
      ).toHaveBeenCalledExactlyOnceWith(seconds)
      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('keeps paging when the focused text is replaced', async () => {
      const context = createContextValue()
      context.reader.areControlsVisible = false
      const user = userEvent.setup()
      const renderPage = (page: number) => (
        <ReaderContext value={context}>
          <ReaderControls controls={<button>Home</button>}>
            <p key={page} tabIndex={0}>
              Book content
            </p>
          </ReaderControls>
        </ReaderContext>
      )
      const view = render(renderPage(1))
      screen.getByText('Book content').focus()
      vi.mocked(context.reader.setControlsVisible).mockClear()

      await user.keyboard('{ArrowRight}')
      view.rerender(renderPage(2))
      await user.keyboard('{ArrowRight}')

      expect(context.navigation.requestPageNavigation).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('region', { name: 'Reader' })).toHaveFocus()
      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    })

    it.each([
      ['PageDown', 1],
      ['ArrowRight', 1],
      ['ArrowDown', 1],
      ['PageUp', -1],
      ['ArrowLeft', -1],
      ['ArrowUp', -1],
    ])('maps %s to direction %i', (key, delta) => {
      const { context } = renderControls(false)

      fireEvent.keyDown(screen.getByText('Book content'), { key })

      expect(
        context.navigation.requestPageNavigation,
      ).toHaveBeenCalledExactlyOnceWith({
        scope: 'local',
        kind: 'relative',
        delta,
      })
      expect(context.reader.setControlsVisible).not.toHaveBeenCalled()
    })

    it('uses the indexed book scope when available', () => {
      const { context, update } = renderControls()
      context.navigation.globalPage = 3
      context.navigation.indexedPageCount = 20
      update()

      fireEvent.keyDown(screen.getByText('Book content'), { key: 'PageDown' })

      expect(
        context.navigation.requestPageNavigation,
      ).toHaveBeenCalledExactlyOnceWith({
        scope: 'global',
        kind: 'relative',
        delta: 1,
      })
    })

    it.each([
      { repeat: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { metaKey: true },
    ])('ignores modified or repeated keys: %j', (options) => {
      const { context } = renderControls()

      fireEvent.keyDown(screen.getByText('Book content'), {
        key: 'PageDown',
        ...options,
      })

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('leaves overlay controls alone', () => {
      const { context } = renderControls()

      fireEvent.keyDown(screen.getByRole('button', { name: 'Home' }), {
        key: 'PageDown',
      })

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })
  })
})
