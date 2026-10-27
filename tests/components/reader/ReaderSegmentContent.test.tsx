// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReaderSegmentContent } from '../../../src/components/atoms/ReaderSegmentContent/ReaderSegmentContent'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import type { ReaderSegment } from '../../../src/models/reader'
import {
  readerSegments,
  unsafeReaderSegment,
} from '../../../src/mock-data/readerSegments'

afterEach(() => {
  cleanup()
  window.getSelection()?.removeAllRanges()
})

function createContextValue(): ReaderContextValue {
  return {
    currentPage: 1,
    pageCount: null,
    textSizePercent: 100,
    setCurrentPage: vi.fn(),
    reportPageCount: vi.fn(),
    selectedSegmentId: null,
    highlightedSegmentId: null,
    selectSegment: vi.fn(),
    highlightSegment: vi.fn(),
    reportSegmentError: vi.fn(),
  }
}

function renderSegmentContent(
  segment: ReaderSegment,
  context = createContextValue(),
) {
  return render(
    <ReaderContext value={context}>
      <ReaderSegmentContent segment={segment} />
    </ReaderContext>,
  )
}

function renderKeyboardEntries(context: ReaderContextValue) {
  return render(
    <ReaderContext value={context}>
      <ReaderSegmentContent segment={readerSegments[0]} isKeyboardEntry />
      <ReaderSegmentContent segment={readerSegments[1]} />
    </ReaderContext>,
  )
}

function dispatchPointerEvent(
  element: Element,
  type: 'pointerdown' | 'pointermove',
  clientX: number,
) {
  // jsdom has no PointerEvent constructor; MouseEvent supplies the coordinates.
  fireEvent(
    element,
    new MouseEvent(type, { bubbles: true, clientX, clientY: 0 }),
  )
}

describe('ReaderSegmentContent', () => {
  describe('rendering', () => {
    it('renders a semantic heading', () => {
      renderSegmentContent(readerSegments[0])

      expect(
        screen.getByRole('heading', { name: 'A small beginning', level: 2 }),
      ).toBeVisible()
    })

    it('renders nested emphasis', () => {
      const { container } = renderSegmentContent(readerSegments[1])

      expect(container.querySelector('strong > em')).toHaveTextContent(
        'and italic',
      )
    })

    it('renders explicit verse breaks', () => {
      const { container } = renderSegmentContent(readerSegments[2])

      expect(container.querySelectorAll('p > br')).toHaveLength(2)
    })

    it('sets the segment language', () => {
      renderSegmentContent(readerSegments[3])

      expect(screen.getByText(/ಕನ್ನಡ/).closest('[lang]')).toHaveAttribute(
        'lang',
        'kn',
      )
    })

    it('preserves Kannada, combining marks and emoji', () => {
      renderSegmentContent(readerSegments[3])

      expect(screen.getByText(/ಕನ್ನಡ/)).toHaveTextContent(
        'ಕನ್ನಡ ಗೀತಾಭಾವಧಾರೆ — é 👩‍👩‍👧‍👦',
      )
    })

    it('does not turn ordinary prose into a button or a Tab stop', () => {
      const { container } = renderSegmentContent(readerSegments[1])

      expect(
        container.querySelectorAll('button, [role="button"], [tabindex="0"]'),
      ).toHaveLength(0)
    })

    it('adds a prefix to imported classes in the rendered DOM', () => {
      const segment = {
        ...readerSegments[1],
        html_content: '<p class="first-style second-style">Some text</p>',
        text_content: 'Some text',
      }

      const { container } = renderSegmentContent(segment)

      expect(container.querySelector('p')).toHaveAttribute(
        'class',
        'reader-import-first-style reader-import-second-style',
      )
    })
  })

  describe('invalid content', () => {
    it('replaces invalid HTML with a safe placeholder', () => {
      const { container } = renderSegmentContent(unsafeReaderSegment)

      expect(
        screen.getByText('This text segment could not be displayed safely.'),
      ).toBeVisible()
      expect(screen.queryByText('Rejected text')).toBeNull()
      expect(container.querySelector('img, script, [onclick]')).toBeNull()
    })

    it('keeps valid neighbors readable around an invalid segment', () => {
      const context = createContextValue()

      const { container } = render(
        <ReaderContext value={context}>
          <ReaderSegmentContent segment={readerSegments[0]} />
          <ReaderSegmentContent segment={unsafeReaderSegment} />
          <ReaderSegmentContent segment={readerSegments[1]} />
        </ReaderContext>,
      )

      expect(screen.getByRole('heading')).toBeVisible()
      expect(container.querySelector('strong > em')).toHaveTextContent(
        'and italic',
      )
    })

    it('does not activate an invalid segment', () => {
      const context = createContextValue()
      const { container } = renderSegmentContent(unsafeReaderSegment, context)

      fireEvent.click(container.querySelector('[data-reader-segment-id="7"]')!)

      expect(context.selectSegment).not.toHaveBeenCalled()
    })

    it('reports an invalid segment through context', () => {
      const context = createContextValue()

      renderSegmentContent(unsafeReaderSegment, context)

      expect(context.reportSegmentError).toHaveBeenCalledExactlyOnceWith({
        segmentId: 7,
        error: 'unsupported-markup',
      })
    })

    it('revalidates changed HTML and reports that its error has cleared', () => {
      const context = createContextValue()
      const view = renderSegmentContent(unsafeReaderSegment, context)
      const correctedSegment = {
        ...unsafeReaderSegment,
        html_content: '<p>Corrected</p>',
        text_content: 'Corrected',
      }
      vi.mocked(context.reportSegmentError).mockClear()

      view.rerender(
        <ReaderContext value={context}>
          <ReaderSegmentContent segment={correctedSegment} />
        </ReaderContext>,
      )

      expect(screen.getByText('Corrected')).toBeVisible()
      expect(context.reportSegmentError).toHaveBeenCalledExactlyOnceWith({
        segmentId: 7,
        error: null,
      })
    })
  })

  describe('activation', () => {
    it('activates a segment when its nested text is clicked', () => {
      const context = createContextValue()
      renderSegmentContent(readerSegments[1], context)

      fireEvent.click(screen.getByText('and italic'))

      expect(context.selectSegment).toHaveBeenCalledExactlyOnceWith(2)
    })

    it.each(['Enter', ' '])(
      'activates a focused segment with the %j key',
      (key) => {
        const context = createContextValue()
        const { container } = renderSegmentContent(readerSegments[1], context)
        const segment = container.querySelector<HTMLElement>(
          '[data-reader-segment-id="2"]',
        )!
        segment.focus()

        fireEvent.keyDown(segment, { key })

        expect(context.selectSegment).toHaveBeenCalledExactlyOnceWith(2)
      },
    )
  })

  describe('keyboard focus', () => {
    it('provides a single initial keyboard entry', async () => {
      const { container } = renderKeyboardEntries(createContextValue())

      await userEvent.setup().tab()

      expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
      expect(
        container.querySelector('[data-reader-segment-id="1"]'),
      ).toHaveFocus()
    })

    it('uses the selected segment as the sole keyboard entry', async () => {
      const context = { ...createContextValue(), selectedSegmentId: 2 }
      const { container } = renderKeyboardEntries(context)

      await userEvent.setup().tab()

      expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
      expect(
        container.querySelector('[data-reader-segment-id="2"]'),
      ).toHaveFocus()
    })
  })

  describe('native selection and dragging', () => {
    it('preserves native text selection without activating the segment', () => {
      const context = createContextValue()
      const { container } = renderSegmentContent(readerSegments[1], context)
      const block = container.querySelector('p')!
      const selection = window.getSelection()!
      const range = document.createRange()
      range.selectNodeContents(block)
      selection.addRange(range)

      fireEvent.click(block)

      expect(selection.toString()).toBe(readerSegments[1].text_content)
      expect(context.selectSegment).not.toHaveBeenCalled()
    })

    it('suppresses activation after dragging when no native selection remains', () => {
      const context = createContextValue()
      const { container } = renderSegmentContent(readerSegments[1], context)
      const block = container.querySelector('p')!

      dispatchPointerEvent(block, 'pointerdown', 0)
      dispatchPointerEvent(block, 'pointermove', 25)
      fireEvent.click(block)

      expect(context.selectSegment).not.toHaveBeenCalled()
    })

    it('allows a fresh click after a previous drag', () => {
      const context = createContextValue()
      const { container } = renderSegmentContent(readerSegments[1], context)
      const block = container.querySelector('p')!
      dispatchPointerEvent(block, 'pointerdown', 0)
      dispatchPointerEvent(block, 'pointermove', 25)
      fireEvent.click(block)

      dispatchPointerEvent(block, 'pointerdown', 25)
      fireEvent.click(block)

      expect(context.selectSegment).toHaveBeenCalledExactlyOnceWith(2)
    })
  })

  describe('context state', () => {
    it('requires a context provider', () => {
      expect(() =>
        render(<ReaderSegmentContent segment={readerSegments[0]} />),
      ).toThrow('useReaderContext requires a ReaderProvider')
    })

    it.each([
      {
        state: 'selected',
        selectedSegmentId: 2,
        highlightedSegmentId: null,
        attribute: 'data-reader-selected',
      },
      {
        state: 'highlighted',
        selectedSegmentId: null,
        highlightedSegmentId: 2,
        attribute: 'data-reader-highlighted',
      },
    ])(
      'marks a segment as $state from context',
      ({ selectedSegmentId, highlightedSegmentId, attribute }) => {
        const context = {
          ...createContextValue(),
          selectedSegmentId,
          highlightedSegmentId,
        }

        const { container } = renderSegmentContent(readerSegments[1], context)

        expect(
          container.querySelector('[data-reader-segment-id="2"]'),
        ).toHaveAttribute(attribute, 'true')
      },
    )
  })
})
