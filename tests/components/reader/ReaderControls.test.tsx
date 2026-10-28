// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderControls } from '../../../src/components/molecules/ReaderControls/ReaderControls'

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
      highlightSegment: vi.fn(),
      reportLayoutKey: () => undefined,
      reportSegmentError: vi.fn(),
    },
  }
}

function renderControls(isVisible = true) {
  const context = createContextValue()
  context.reader.areControlsVisible = isVisible
  const show = () => (
    <ReaderContext value={context}>
      <ReaderControls controls={<button>Home</button>}>
        <p tabIndex={0}>Book content</p>
        <button>Content action</button>
      </ReaderControls>
    </ReaderContext>
  )
  const view = render(show())

  return { context, update: () => view.rerender(show()) }
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

describe('ReaderControls', () => {
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
    it.each([
      [-100, 0, 1],
      [0, -100, 1],
      [100, 0, -1],
      [0, 100, -1],
    ])('maps a swipe of %i,%i to direction %i', (dx, dy, delta) => {
      const { context } = renderControls(false)
      const text = screen.getByText('Book content')

      dispatchPointer(text, 'pointerdown', 0, { pointerType: 'touch' })
      dispatchPointer(text, 'pointermove', dx, { pointerType: 'touch', y: dy })
      dispatchPointer(text, 'pointerup', dx, { pointerType: 'touch', y: dy })
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
      {
        name: 'a long press and drag',
        dx: 100,
        dy: 0,
        pointerType: 'touch',
        duration: 1000,
      },
    ])('ignores $name', ({ dx, dy, pointerType, duration }) => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')

      dispatchPointer(text, 'pointerdown', 0, { pointerType, timeStamp: 100 })
      dispatchPointer(text, 'pointerup', dx, {
        pointerType,
        y: dy,
        timeStamp: 100 + duration,
      })

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('ignores multitouch', () => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')

      dispatchPointer(text, 'pointerdown', 0, { pointerType: 'touch' })
      dispatchPointer(text, 'pointerdown', 0, {
        pointerType: 'touch',
        isPrimary: false,
      })
      dispatchPointer(text, 'pointerup', -100, { pointerType: 'touch' })

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('ignores a cancelled touch', () => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')

      dispatchPointer(text, 'pointerdown', 0, { pointerType: 'touch' })
      dispatchPointer(text, 'pointercancel')
      dispatchPointer(text, 'pointerup', -100, { pointerType: 'touch' })

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it.each(['Home', 'Content action'])('ignores a swipe on %s', (name) => {
      const { context } = renderControls()
      const button = screen.getByRole('button', { name })

      dispatchPointer(button, 'pointerdown', 0, { pointerType: 'touch' })
      dispatchPointer(button, 'pointerup', -100, { pointerType: 'touch' })

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })

    it('leaves native text selection alone', () => {
      const { context } = renderControls()
      const text = screen.getByText('Book content')
      const range = document.createRange()
      range.selectNodeContents(text)
      window.getSelection()?.addRange(range)

      dispatchPointer(text, 'pointerdown', 0, { pointerType: 'touch' })
      dispatchPointer(text, 'pointerup', -100, { pointerType: 'touch' })

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })
  })

  describe('keyboard paging', () => {
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
