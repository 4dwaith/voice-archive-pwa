// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
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
      currentPage: 3,
      pageCount: 6,
      globalPage: 9,
      totalPageCount: null,
      indexedPageCount: 12,
      isPageNavigationPending: false,
      requestPageNavigation: vi.fn(),
      setCurrentPage: vi.fn(),
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

  render(
    <ReaderContext value={context}>
      <ReaderProgressNavigation />
    </ReaderContext>,
  )

  return context
}

it('shows partial progress honestly and explains a jump outside the indexed prefix', async () => {
  const context = renderNavigation()
  const user = userEvent.setup()
  expect(screen.getByText('Section page 3 of 6.')).toBeVisible()
  expect(screen.getByText('Book page 9; total unknown.')).toBeVisible()
  expect(screen.getByText('12 book pages indexed.')).toBeVisible()
  expect(screen.getByRole('slider')).toHaveAttribute('max', '12')

  await user.type(screen.getByLabelText('Book page'), '13')
  await user.click(screen.getByRole('button', { name: 'Go' }))

  expect(screen.getByRole('status')).toHaveTextContent(
    'Enter a whole page number from 1 to 12.',
  )
  expect(screen.getByLabelText('Book page')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
})

it('submits a numbered book jump explicitly with Enter', async () => {
  const context = renderNavigation({ totalPageCount: 12 })
  expect(screen.getByText('Book page 9 of 12.')).toBeVisible()
  expect(screen.queryByText(/pages indexed/)).toBeNull()

  await userEvent.setup().type(screen.getByLabelText('Book page'), '5{Enter}')

  expect(
    context.navigation.requestPageNavigation,
  ).toHaveBeenCalledExactlyOnceWith({
    scope: 'global',
    kind: 'absolute',
    pageNumber: 5,
  })
})

it('emits the bounded local delta when the global position is unknown', async () => {
  const context = renderNavigation({ globalPage: null })
  expect(
    screen.getByRole('group', { name: 'Section page steps' }),
  ).toBeVisible()
  expect(screen.getByRole('slider')).toBeDisabled()

  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Back 5 pages' }))

  expect(
    context.navigation.requestPageNavigation,
  ).toHaveBeenCalledExactlyOnceWith({
    scope: 'local',
    kind: 'relative',
    delta: -2,
  })
})

it('shows pending status and prevents repeated activation', async () => {
  const context = renderNavigation({ isPageNavigationPending: true })

  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Forward 5 pages' }))

  expect(screen.getByRole('status')).toHaveTextContent('Changing page…')
  expect(screen.getByLabelText('Book page')).toBeDisabled()
  expect(context.navigation.requestPageNavigation).not.toHaveBeenCalled()
})

it.each([0, null])(
  'disables unavailable controls for local count %s without showing page zero',
  (pageCount) => {
    renderNavigation({
      pageCount,
      globalPage: null,
      totalPageCount: pageCount,
      indexedPageCount: 0,
    })

    expect(
      screen.getByText(
        pageCount === 0
          ? 'No book pages.'
          : 'Book page unknown; total unknown.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Forward 1 page' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled()
    expect(screen.getByLabelText('Book page')).toHaveValue(null)
    expect(screen.queryByText(/page 0\b/)).toBeNull()
  },
)
