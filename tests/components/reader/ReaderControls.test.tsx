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
      requestPageNavigation: () => undefined,
      currentPage: 1,
      pageCount: null,
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

function dispatchPointer(element: Element, type: string, clientX = 0) {
  const event = new MouseEvent(type, { bubbles: true, clientX })
  Object.defineProperty(event, 'isPrimary', { value: true })
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

    expect(screen.getByText('Book content')).toHaveFocus()
    expect(context.reader.setControlsVisible).toHaveBeenCalledWith(true)
  })

  it('reveals on a key while text is focused', () => {
    const { context } = renderControls(false)
    const text = screen.getByText('Book content')
    act(() => text.focus())
    vi.mocked(context.reader.setControlsVisible).mockClear()

    fireEvent.keyDown(text, { key: 'ArrowRight' })

    expect(context.reader.setControlsVisible).toHaveBeenCalledExactlyOnceWith(
      true,
    )
  })

  it('returns collapsed header focus to the named toggle', () => {
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
    expect(
      screen.getByRole('button', { name: 'Show reader controls' }),
    ).toHaveFocus()
    expect(context.reader.setControlsVisible).toHaveBeenCalledTimes(1)
  })

  it.each(['pointer', 'keyboard'])('provides a %s toggle', async (input) => {
    const { context } = renderControls(false)
    const user = userEvent.setup()
    const toggle = screen.getByRole('button', { name: 'Show reader controls' })
    if (input === 'keyboard') act(() => toggle.focus())
    vi.mocked(context.reader.setControlsVisible).mockClear()

    if (input === 'pointer') await user.click(toggle)
    else await user.keyboard('{Enter}')

    expect(context.reader.setControlsVisible).toHaveBeenCalledExactlyOnceWith(
      true,
    )
  })
})
