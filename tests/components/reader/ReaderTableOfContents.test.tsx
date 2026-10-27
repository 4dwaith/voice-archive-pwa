// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderTableOfContents } from '../../../src/components/atoms/ReaderTableOfContents/ReaderTableOfContents'
import { readerSections } from '../../../src/mock-data/readerSections.ts'

afterEach(cleanup)

function renderToc(sections = readerSections) {
  const context: ReaderContextValue = {
    selectedSectionId: null,
    isSectionExpanded: () => true,
    tocPresentation: 'shown',
    selectSection: vi.fn((selectedSectionId) =>
      updateContext({ selectedSectionId }),
    ),
    setSectionExpanded: vi.fn(({ sectionId, isExpanded }) => {
      const wasSectionExpanded = context.isSectionExpanded

      updateContext({
        isSectionExpanded: (id) =>
          id === sectionId ? isExpanded : wasSectionExpanded(id),
      })
    }),
    setTocPresentation: vi.fn((tocPresentation) =>
      updateContext({ tocPresentation }),
    ),
    currentPage: 1,
    pageCount: null,
    textSizePercent: 100,
    selectedSegmentId: null,
    highlightedSegmentId: null,
    setCurrentPage: vi.fn(),
    reportPageCount: vi.fn(),
    selectSegment: vi.fn(),
    highlightSegment: vi.fn(),
    reportSegmentError: vi.fn(),
  }

  function renderContent() {
    return (
      <ReaderContext value={{ ...context }}>
        <ReaderTableOfContents sections={sections} />
      </ReaderContext>
    )
  }

  const view = render(renderContent())

  function updateContext(change: Partial<ReaderContextValue>) {
    Object.assign(context, change)
    view.rerender(renderContent())
  }

  return { context, updateContext }
}

it('nests by parent, orders by sequence and selects a repeated title by identity', async () => {
  const { context } = renderToc([...readerSections].reverse())
  const nav = screen.getByRole('navigation', { name: 'Table of contents' })
  const roots = within(nav).getAllByRole('list')[0].children
  expect(roots).toHaveLength(2)
  expect(roots[0]).toHaveTextContent('Part one')
  expect(
    within(roots[0] as HTMLElement).getByRole('button', { name: /deep leaf/ }),
  ).toBeVisible()
  const repeatedTitle = within(roots[1] as HTMLElement).getByRole('button', {
    name: 'Beginning',
  })

  await userEvent.setup().click(repeatedTitle)

  expect(context.selectSection).toHaveBeenCalledExactlyOnceWith(7)
  expect(repeatedTitle).toHaveAttribute('aria-current', 'true')
  expect(
    screen.getAllByRole('button', { name: 'Beginning' })[0],
  ).not.toHaveAttribute('aria-current')
})

it('discloses independently of selection and hides closed descendants from Tab', async () => {
  const { context } = renderToc()
  const user = userEvent.setup()
  const disclosure = screen.getByLabelText('Subsections of Part one')
  expect(disclosure).toHaveAttribute('aria-expanded', 'true')

  await user.click(disclosure)

  expect(context.setSectionExpanded).toHaveBeenCalledExactlyOnceWith({
    sectionId: 1,
    isExpanded: false,
  })
  expect(context.selectSection).not.toHaveBeenCalled()
  expect(disclosure.closest('details')).not.toHaveAttribute('open')
  expect(
    screen.getByRole('button', { name: /deep leaf/, hidden: true }),
  ).not.toBeVisible()

  await user.tab()

  expect(screen.getByRole('button', { name: 'Part two' })).toHaveFocus()

  await user.click(disclosure)

  expect(screen.getByRole('button', { name: /deep leaf/ })).toBeVisible()
})

it('returns focus to the ancestor disclosure when context closes a focused branch', () => {
  const { updateContext } = renderToc()
  screen.getByRole('button', { name: /deep leaf/ }).focus()

  updateContext({
    isSectionExpanded: (sectionId) => sectionId !== 1 && sectionId !== 3,
  })

  expect(screen.getByLabelText('Subsections of Part one')).toHaveFocus()
})

it('collapses through context, recovers focus and exposes a named reopen control', async () => {
  const { context, updateContext } = renderToc()
  screen.getByRole('button', { name: /deep leaf/ }).focus()

  updateContext({ tocPresentation: 'collapsed' })

  const reopen = screen.getByRole('button', {
    name: 'Show table of contents',
    expanded: false,
  })
  expect(reopen).toHaveFocus()
  expect(screen.queryByRole('button', { name: 'Part one' })).toBeNull()

  await userEvent.setup().click(reopen)

  expect(context.setTocPresentation).toHaveBeenCalledExactlyOnceWith('shown')
  expect(
    screen.getByRole('button', {
      name: 'Collapse table of contents',
      expanded: true,
    }),
  ).toBeVisible()
})

it('renders an explicit empty state', () => {
  renderToc([])

  expect(screen.getByText('No sections available.')).toBeVisible()
  expect(screen.queryByRole('list')).toBeNull()
})
