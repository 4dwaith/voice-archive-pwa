// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
  type ReaderSearchValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderSearch } from '../../../src/components/molecules/ReaderSearch/ReaderSearch'

afterEach(cleanup)

function renderSearch(overrides: Partial<ReaderSearchValue> = {}) {
  const search: ReaderSearchValue = {
    results: [],
    resultsQuery: '',
    status: 'idle',
    error: null,
    isOpen: false,
    submitQuery: vi.fn(),
    setOpen: vi.fn(),
    clear: vi.fn(),
    openResult: vi.fn(),
    ...overrides,
  }
  const value: ReaderContextValue = {
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
      setPageScope: vi.fn(),
      currentPage: 1,
      pageCount: null,
      globalPage: null,
      totalPageCount: null,
      indexedPageCount: 0,
      isPageNavigationPending: false,
      requestPageNavigation: vi.fn(),
      setCurrentPage: vi.fn(),
      reportPageMeasurement: vi.fn(),
    },
    reader: {
      areControlsVisible: true,
      setControlsVisible: vi.fn(),
      reportLayoutKey: vi.fn(),
      textSizePercent: 100,
      selectedSegmentId: null,
      highlightedSegmentId: null,
      selectSegment: vi.fn(),
      highlightSegment: vi.fn(),
      reportSegmentError: vi.fn(),
      search,
    },
  }
  render(
    <ReaderContext value={value}>
      <ReaderSearch />
    </ReaderContext>,
  )
  return search
}

describe('ReaderSearch', () => {
  it('submits only on explicit submission and rejects blank input', () => {
    const search = renderSearch()

    fireEvent.submit(screen.getByRole('form', { name: 'Book search' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a search phrase.',
    )
    expect(search.submitQuery).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: ' river ' },
    })

    expect(search.submitQuery).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(search.submitQuery).toHaveBeenCalledWith(' river ')
  })

  it('shows the chapter and plain fragments while a new search loads', () => {
    const result = {
      segmentId: 1,
      offset: 5,
      chapterId: '1',
      chapterTitle: 'Chapter one',
      before: 'the ',
      match: '<river>',
      after: ' bank',
    }
    const search = renderSearch({
      isOpen: true,
      status: 'loading',
      resultsQuery: '<river>',
      results: [result],
    })

    expect(screen.getByRole('status')).toHaveTextContent('Searching…')
    expect(screen.getByText('Results for “<river>”')).toBeVisible()
    expect(screen.getByText('<river>', { selector: 'strong' })).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Chapter one the <river> bank' }),
    )

    expect(search.openResult).toHaveBeenCalledWith(result)
  })

  it.each([
    { status: 'succeeded' as const, error: null, message: 'No matches.' },
    {
      status: 'failed' as const,
      error: 'Search failed.',
      message: 'Search failed.',
    },
  ])('shows $status feedback', ({ status, error, message }) => {
    renderSearch({ isOpen: true, status, error })

    expect(screen.getByText(message)).toBeVisible()
  })

  it('reopens retained results without resubmission', () => {
    const search = renderSearch({ status: 'succeeded' })

    fireEvent.click(
      screen.getByRole('button', { name: 'Reopen search results' }),
    )

    expect(search.setOpen).toHaveBeenCalledWith(true)
    expect(search.submitQuery).not.toHaveBeenCalled()
  })
})
