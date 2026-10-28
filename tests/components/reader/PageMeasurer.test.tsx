// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderChapterLayout } from '../../../src/components/atoms/ReaderChapterLayout/ReaderChapterLayout'
import { PageMeasurer } from '../../../src/components/molecules/PageMeasurer/PageMeasurer'
import { readerPageSegments } from '../../../src/mock-data/readerPages'

vi.mock(
  '../../../src/components/atoms/ReaderChapterLayout/ReaderChapterLayout',
  () => ({
    ReaderChapterLayout: vi.fn(() => <div data-testid="chapter-layout" />),
  }),
)

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

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
      setPageScope: vi.fn(),
      currentPage: 99,
      pageCount: null,
      globalPage: null,
      totalPageCount: null,
      indexedPageCount: 0,
      isPageNavigationPending: false,
      requestPageNavigation: vi.fn(),
      setCurrentPage: vi.fn(),
      reportPageCount: vi.fn(),
      reportPageMeasurement: vi.fn(),
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
}

function finishMeasurement(layoutKey = 'layout', textSizePercent = 100) {
  const props = vi.mocked(ReaderChapterLayout).mock.calls.at(-1)![0]

  act(() =>
    props.onPageMeasure!({
      layoutKey,
      width: 320,
      height: 212,
      textSizePercent,
      pages: [],
      unmappableSegmentIds: [],
    }),
  )
}

function renderMeasurer(props: ComponentProps<typeof PageMeasurer>) {
  const context = createContextValue()
  const view = render(<PageMeasurer {...props} />, {
    wrapper: ({ children }) => (
      <ReaderContext value={context}>{children}</ReaderContext>
    ),
  })

  return { ...view, context }
}

describe('PageMeasurer', () => {
  it('advances through chapters in order', () => {
    const chapterSegments = { first: readerPageSegments, second: [] }
    const { context } = renderMeasurer({
      chapterIds: ['second', 'first'],
      chapterSegments,
      layoutKey: 'layout',
    })

    expect(vi.mocked(ReaderChapterLayout).mock.lastCall![0]).toMatchObject({
      segments: chapterSegments.second,
      page: 1,
      shouldMeasure: true,
    })

    finishMeasurement()

    expect(context.navigation.reportPageMeasurement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chapterId: 'second',
        layoutKey: 'layout',
        pages: [],
      }),
    )
    expect(vi.mocked(ReaderChapterLayout).mock.lastCall![0].segments).toBe(
      chapterSegments.first,
    )

    finishMeasurement()

    expect(context.navigation.reportPageMeasurement).toHaveBeenCalledTimes(2)
    expect(context.navigation.reportPageMeasurement).toHaveBeenLastCalledWith(
      expect.objectContaining({ chapterId: 'first' }),
    )
    expect(screen.queryByTestId('chapter-layout')).not.toBeInTheDocument()
  })

  it('ignores a report for a different layout key', () => {
    const { context } = renderMeasurer({
      chapterIds: ['first'],
      chapterSegments: { first: readerPageSegments },
      layoutKey: 'current',
    })

    finishMeasurement('obsolete')

    expect(context.navigation.reportPageMeasurement).not.toHaveBeenCalled()
    expect(screen.getByTestId('chapter-layout')).toBeInTheDocument()
  })

  it('hides measurement content from interaction and accessibility', () => {
    renderMeasurer({
      chapterIds: ['first'],
      chapterSegments: { first: readerPageSegments },
      layoutKey: 'layout',
    })

    expect(screen.getByTestId('chapter-layout').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByTestId('chapter-layout').parentElement).toHaveAttribute(
      'inert',
    )
  })

  it('waits for a missing chapter array', () => {
    const chapterIds = ['missing', 'available']
    const { rerender } = renderMeasurer({
      chapterIds,
      chapterSegments: { available: readerPageSegments },
      layoutKey: 'layout',
    })

    expect(ReaderChapterLayout).not.toHaveBeenCalled()

    rerender(
      <PageMeasurer
        chapterIds={chapterIds}
        chapterSegments={{ missing: [], available: readerPageSegments }}
        layoutKey="layout"
      />,
    )

    expect(vi.mocked(ReaderChapterLayout).mock.lastCall![0].segments).toEqual(
      [],
    )
  })

  it('measures again for a different layout', () => {
    const chapterSegments = { first: readerPageSegments }
    const { rerender, context } = renderMeasurer({
      chapterIds: ['first'],
      chapterSegments,
      layoutKey: 'old',
    })
    finishMeasurement('old')

    rerender(
      <PageMeasurer
        chapterIds={['first']}
        chapterSegments={chapterSegments}
        layoutKey="new"
      />,
    )
    finishMeasurement('new')

    expect(context.navigation.reportPageMeasurement).toHaveBeenLastCalledWith(
      expect.objectContaining({ chapterId: 'first', layoutKey: 'new' }),
    )
  })

  it('measures a changed chapter array again', () => {
    const { rerender } = renderMeasurer({
      chapterIds: ['first'],
      chapterSegments: { first: readerPageSegments },
      layoutKey: 'layout',
    })
    finishMeasurement()
    const changedSegments = [...readerPageSegments]

    rerender(
      <PageMeasurer
        chapterIds={['first']}
        chapterSegments={{ first: changedSegments }}
        layoutKey="layout"
      />,
    )

    expect(vi.mocked(ReaderChapterLayout).mock.lastCall![0].segments).toBe(
      changedSegments,
    )
    expect(screen.getByTestId('chapter-layout')).toBeInTheDocument()
  })
})
