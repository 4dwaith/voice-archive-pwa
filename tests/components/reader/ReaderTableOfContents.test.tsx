// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderTableOfContents } from '../../../src/components/atoms/ReaderTableOfContents/ReaderTableOfContents'
import { readerSections } from '../../../src/mock-data/readerSections.ts'

afterEach(cleanup)

function renderToc(
  sections = readerSections,
  overrides: Partial<ReaderContextValue['toc']> = {},
) {
  const context: ReaderContextValue = {
    toc: {
      selectedSectionId: null,
      isSectionExpanded: () => true,
      tocPresentation: 'shown',
      selectSection: vi.fn((selectedSectionId) =>
        updateContext({ selectedSectionId }),
      ),
      setSectionExpanded: vi.fn(({ sectionId, isExpanded }) => {
        const wasSectionExpanded = context.toc.isSectionExpanded

        updateContext({
          isSectionExpanded: (id) =>
            id === sectionId ? isExpanded : wasSectionExpanded(id),
        })
      }),
      setTocPresentation: vi.fn((tocPresentation) =>
        updateContext({ tocPresentation }),
      ),
      ...overrides,
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
      reportPageCount: vi.fn(),
    },
    reader: {
      textSizePercent: 100,
      selectedSegmentId: null,
      highlightedSegmentId: null,
      selectSegment: vi.fn(),
      highlightSegment: vi.fn(),
      reportLayoutKey: () => undefined,
      reportSegmentError: vi.fn(),
    },
  }

  function renderContent() {
    return (
      <ReaderContext value={{ ...context }}>
        <ReaderTableOfContents sections={sections} />
      </ReaderContext>
    )
  }

  const view = render(renderContent())

  function updateContext(change: Partial<ReaderContextValue['toc']>) {
    Object.assign(context.toc, change)
    view.rerender(renderContent())
  }

  return { context, updateContext }
}

describe('ReaderTableOfContents', () => {
  describe('hierarchy', () => {
    it('orders root sections', () => {
      renderToc([...readerSections].reverse())
      const nav = screen.getByRole('navigation', { name: 'Table of contents' })
      const roots = within(nav).getAllByRole('list')[0].children

      expect(roots).toHaveLength(2)
      expect(roots[0]).toHaveTextContent('Part one')
      expect(roots[1]).toHaveTextContent('Part two')
    })

    it('nests child sections', () => {
      renderToc()
      const parent = screen
        .getByRole('button', { name: 'Another level' })
        .closest('li')!

      expect(
        within(parent).getByRole('button', { name: /deep leaf/ }),
      ).toBeVisible()
    })

    it('shows an empty state', () => {
      renderToc([])

      expect(screen.getByText('No sections available.')).toBeVisible()
      expect(screen.queryByRole('list')).toBeNull()
    })
  })

  describe('selection', () => {
    it('selects a repeated title', async () => {
      const { context } = renderToc()
      const parent = screen
        .getByRole('button', { name: 'Part two' })
        .closest('li')!
      const section = within(parent).getByRole('button', { name: 'Beginning' })

      await userEvent.setup().click(section)

      expect(context.toc.selectSection).toHaveBeenCalledExactlyOnceWith(7)
    })

    it('marks the selected section', () => {
      renderToc(readerSections, { selectedSectionId: 7 })
      const parent = screen
        .getByRole('button', { name: 'Part two' })
        .closest('li')!
      const selected = within(parent).getByRole('button', { name: 'Beginning' })
      const otherParent = screen
        .getByRole('button', { name: 'Part one' })
        .closest('li')!
      const other = within(otherParent).getByRole('button', {
        name: 'Beginning',
      })

      expect(selected).toHaveAttribute('aria-current', 'true')
      expect(other).not.toHaveAttribute('aria-current')
    })
  })

  describe('branches', () => {
    it('starts expanded', () => {
      renderToc()
      const disclosure = screen.getByLabelText('Subsections of Part one')

      expect(disclosure).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('button', { name: /deep leaf/ })).toBeVisible()
    })

    it('closes a branch', async () => {
      const { context } = renderToc()
      const disclosure = screen.getByLabelText('Subsections of Part one')

      await userEvent.setup().click(disclosure)

      expect(context.toc.setSectionExpanded).toHaveBeenCalledExactlyOnceWith({
        sectionId: 1,
        isExpanded: false,
      })
      expect(disclosure).toHaveAttribute('aria-expanded', 'false')
      expect(
        screen.getByRole('button', { name: /deep leaf/, hidden: true }),
      ).not.toBeVisible()
    })

    it('opens a branch', async () => {
      const { context } = renderToc(readerSections, {
        isSectionExpanded: (id) => id !== 1,
      })
      const disclosure = screen.getByLabelText('Subsections of Part one')

      await userEvent.setup().click(disclosure)

      expect(context.toc.setSectionExpanded).toHaveBeenCalledExactlyOnceWith({
        sectionId: 1,
        isExpanded: true,
      })
      expect(disclosure).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('button', { name: /deep leaf/ })).toBeVisible()
    })

    it('does not select a section', async () => {
      const { context } = renderToc()

      await userEvent
        .setup()
        .click(screen.getByLabelText('Subsections of Part one'))

      expect(context.toc.selectSection).not.toHaveBeenCalled()
    })

    it('skips hidden children with Tab', async () => {
      renderToc(readerSections, { isSectionExpanded: (id) => id !== 1 })
      screen.getByLabelText('Subsections of Part one').focus()

      await userEvent.setup().tab()

      expect(screen.getByRole('button', { name: 'Part two' })).toHaveFocus()
    })
  })

  describe('panel', () => {
    it('collapses the panel', async () => {
      const { context } = renderToc()

      await userEvent
        .setup()
        .click(
          screen.getByRole('button', { name: 'Collapse table of contents' }),
        )

      expect(context.toc.setTocPresentation).toHaveBeenCalledExactlyOnceWith(
        'collapsed',
      )
    })

    it('opens the panel', async () => {
      const { context } = renderToc(readerSections, {
        tocPresentation: 'collapsed',
      })

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Show table of contents' }))

      expect(context.toc.setTocPresentation).toHaveBeenCalledExactlyOnceWith(
        'shown',
      )
    })

    it('hides collapsed content', () => {
      renderToc(readerSections, { tocPresentation: 'collapsed' })

      expect(screen.queryByRole('button', { name: 'Part one' })).toBeNull()
      expect(
        screen.getByRole('button', {
          name: 'Show table of contents',
          expanded: false,
        }),
      ).toBeVisible()
    })
  })

  describe('focus', () => {
    it('focuses a closed ancestor', () => {
      const { updateContext } = renderToc()
      screen.getByRole('button', { name: /deep leaf/ }).focus()

      updateContext({ isSectionExpanded: (id) => id !== 1 && id !== 3 })

      expect(screen.getByLabelText('Subsections of Part one')).toHaveFocus()
    })

    it('focuses the reopen button', () => {
      const { updateContext } = renderToc()
      screen.getByRole('button', { name: /deep leaf/ }).focus()

      updateContext({ tocPresentation: 'collapsed' })

      expect(
        screen.getByRole('button', { name: 'Show table of contents' }),
      ).toHaveFocus()
    })
  })
})
