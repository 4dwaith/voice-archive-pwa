// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderProgressNavigation } from '../../../src/components/atoms/ReaderProgressNavigation/ReaderProgressNavigation'

afterEach(cleanup)

function renderNavigation(
  overrides: Partial<ReaderContextValue['navigation']> = {},
) {
  const context: ReaderContextValue = {
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
      setPageScope: vi.fn((pageScope) => {
        context.navigation.pageScope = pageScope
        view.rerender(renderContent())
      }),
      currentPage: 3,
      pageCount: 6,
      globalPage: 9,
      totalPageCount: null,
      indexedPageCount: 12,
      isPageNavigationPending: false,
      requestPageNavigation: vi.fn(),
      setCurrentPage: vi.fn(),
      reportPageMeasurement: () => undefined,
      reportPageCount: vi.fn(),
      ...overrides,
    },
    reader: {
      textSizePercent: 100,
      selectedSegmentId: null,
      highlightedSegmentId: null,
      selectSegment: vi.fn(),
      highlightSegment: vi.fn(),
      reportSegmentError: vi.fn(),
    },
  }

  function renderContent() {
    return (
      <ReaderContext value={{ ...context }}>
        <ReaderProgressNavigation />
      </ReaderContext>
    )
  }

  const view = render(renderContent())

  return context
}

describe('ReaderProgressNavigation', () => {
  describe('page view', () => {
    it('shows the chapter position', () => {
      renderNavigation()
      const slider = screen.getByRole('slider', { name: 'Chapter page' })

      expect(screen.getByText('Page 3 of 6')).toBeVisible()
      expect(slider).toHaveAttribute('aria-valuenow', '3')
      expect(slider).toHaveAttribute('aria-valuemax', '6')
    })

    it('shows the book position', () => {
      renderNavigation({ pageScope: 'global', totalPageCount: 12 })
      const slider = screen.getByRole('slider', { name: 'Book page' })

      expect(screen.getByText('Page 9 of 12')).toBeVisible()
      expect(slider).toHaveAttribute('aria-valuenow', '9')
      expect(slider).toHaveAttribute('aria-valuemax', '12')
    })

    it.each([
      { name: 'Book', initial: 'local', target: 'global' },
      { name: 'Chapter', initial: 'global', target: 'local' },
    ] as const)('switches to $name', async ({ name, initial, target }) => {
      const context = renderNavigation({ pageScope: initial })

      await userEvent.setup().click(screen.getByRole('button', { name }))

      expect(context.navigation.setPageScope).toHaveBeenCalledExactlyOnceWith(
        target,
      )
      expect(screen.getByRole('button', { name, pressed: true })).toBeVisible()
    })
  })

  describe('page actions', () => {
    it('clamps forward jumps', async () => {
      const context = renderNavigation({ pageScope: 'global' })

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Forward 25 pages' }))

      expect(
        context.navigation.requestPageNavigation,
      ).toHaveBeenCalledExactlyOnceWith({
        scope: 'global',
        kind: 'relative',
        delta: 3,
      })
    })

    it('jumps to the last page with End', () => {
      const context = renderNavigation()

      fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' })

      expect(
        context.navigation.requestPageNavigation,
      ).toHaveBeenCalledExactlyOnceWith({
        scope: 'local',
        kind: 'absolute',
        pageNumber: 6,
      })
    })
  })

  describe('page counts', () => {
    it('shows an unknown book total', () => {
      renderNavigation({ pageScope: 'global' })

      expect(screen.getByText('Page 9 of ?')).toBeVisible()
      expect(
        screen.getByText('12 pages indexed. Book total unknown.'),
      ).toBeVisible()
      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-valuetext',
        'Page 9 of ?; 12 pages indexed, total unknown',
      )
    })

    it('shows an empty chapter', () => {
      renderNavigation({ pageCount: 0 })

      expect(screen.getByText('No pages')).toBeVisible()
      expect(screen.getByText('No chapter pages available.')).toBeVisible()
    })

    it('shows an unknown chapter count', () => {
      renderNavigation({ pageCount: null })

      expect(screen.getByText('Page 3 of ?')).toBeVisible()
      expect(
        screen.getByText('Chapter pages have not been counted yet.'),
      ).toBeVisible()
    })

    it.each([
      { condition: 'an empty chapter', pageCount: 0 },
      { condition: 'an unknown count', pageCount: null },
    ])('disables jumps for $condition', ({ pageCount }) => {
      renderNavigation({ pageCount })

      expect(
        screen.getByRole('button', { name: 'Forward 1 page' }),
      ).toBeDisabled()
      expect(screen.queryByRole('slider')).toBeNull()
    })
  })

  describe('pending navigation', () => {
    it('shows the pending status', () => {
      renderNavigation({ isPageNavigationPending: true })

      expect(screen.getByRole('status')).toHaveTextContent('Changing page…')
    })

    it('disables page controls', () => {
      renderNavigation({ isPageNavigationPending: true })

      expect(
        screen.getByRole('button', { name: 'Forward 5 pages' }),
      ).toBeDisabled()
      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    })

    it('ignores jumps while pending', () => {
      const context = renderNavigation({ isPageNavigationPending: true })

      fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' })

      expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
    })
  })
})
