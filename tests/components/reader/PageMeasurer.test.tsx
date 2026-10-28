// @vitest-environment jsdom
import { Component, type ComponentProps, type ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderChapterLayout } from '../../../src/components/atoms/ReaderChapterLayout/ReaderChapterLayout'
import { PageMeasurer } from '../../../src/components/molecules/PageMeasurer/PageMeasurer'
import type { ReaderSegment } from '../../../src/models/reader'
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
      reportPageMeasurement: vi.fn(),
    },
    reader: {
      areControlsVisible: true,
      setControlsVisible: () => undefined,
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

type MeasurerProps = ComponentProps<typeof PageMeasurer>

function renderMeasurer(props: Partial<MeasurerProps> = {}) {
  const context = createContextValue()
  const initialProps: MeasurerProps = {
    bookId: 7,
    contentVersion: 'version',
    readyChapterIds: new Set(),
    chapterIds: ['first'],
    availableChapterIds: new Set(['first']),
    loadChapterSegments: vi.fn(async () => readerPageSegments),
    layoutKey: 'layout',
    ...props,
  }
  const view = render(<PageMeasurer {...initialProps} />, {
    wrapper: ({ children }) => (
      <ReaderContext value={context}>{children}</ReaderContext>
    ),
  })

  return {
    context,
    rerender: (changes: Partial<MeasurerProps>) =>
      view.rerender(<PageMeasurer {...initialProps} {...changes} />),
  }
}

describe('PageMeasurer', () => {
  it('loads chapters in order after committed readiness advances', async () => {
    const loadChapterSegments = vi.fn(async (chapterId: string) =>
      chapterId === 'second' ? [] : readerPageSegments,
    )
    const { context, rerender } = renderMeasurer({
      chapterIds: ['second', 'first'],
      availableChapterIds: new Set(['second', 'first']),
      loadChapterSegments,
    })

    await screen.findByTestId('chapter-layout')

    expect(vi.mocked(ReaderChapterLayout).mock.lastCall![0]).toMatchObject({
      segments: [],
      page: 1,
      shouldMeasure: true,
    })

    finishMeasurement()

    expect(context.navigation.reportPageMeasurement).toHaveBeenLastCalledWith(
      expect.objectContaining({ chapterId: 'second', pages: [] }),
    )
    expect(loadChapterSegments.mock.calls).toEqual([['second']])

    rerender({ readyChapterIds: new Set(['second']) })
    await screen.findByTestId('chapter-layout')

    expect(vi.mocked(ReaderChapterLayout).mock.lastCall![0].segments).toBe(
      readerPageSegments,
    )
    expect(loadChapterSegments.mock.calls).toEqual([['second'], ['first']])

    finishMeasurement()
    rerender({ readyChapterIds: new Set(['second', 'first']) })

    expect(context.navigation.reportPageMeasurement).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('chapter-layout')).not.toBeInTheDocument()
  })

  it('ignores a report for a different layout key', async () => {
    const { context } = renderMeasurer({ layoutKey: 'current' })
    await screen.findByTestId('chapter-layout')

    finishMeasurement('obsolete')

    expect(context.navigation.reportPageMeasurement).not.toHaveBeenCalled()
    expect(screen.getByTestId('chapter-layout')).toBeInTheDocument()
  })

  it('hides measurement content from interaction and accessibility', async () => {
    renderMeasurer()
    const chapterLayout = await screen.findByTestId('chapter-layout')

    expect(chapterLayout.parentElement).toHaveAttribute('aria-hidden', 'true')
    expect(chapterLayout.parentElement).toHaveAttribute('inert')
  })

  it('waits for complete chapter input', async () => {
    const loadChapterSegments = vi.fn(async () => readerPageSegments)
    const { rerender } = renderMeasurer({
      chapterIds: ['missing', 'first'],
      loadChapterSegments,
    })

    expect(loadChapterSegments).not.toHaveBeenCalled()
    expect(ReaderChapterLayout).not.toHaveBeenCalled()

    rerender({ availableChapterIds: new Set(['missing', 'first']) })
    await screen.findByTestId('chapter-layout')

    expect(loadChapterSegments).toHaveBeenCalledWith('missing')
  })

  it('measures again for a different layout', async () => {
    const { rerender, context } = renderMeasurer({ layoutKey: 'old' })
    await screen.findByTestId('chapter-layout')
    finishMeasurement('old')

    rerender({ layoutKey: 'new' })
    await screen.findByTestId('chapter-layout')
    finishMeasurement('new')

    expect(context.navigation.reportPageMeasurement).toHaveBeenLastCalledWith(
      expect.objectContaining({ chapterId: 'first', layoutKey: 'new' }),
    )
  })

  it('waits after submission until a deliberate retry', async () => {
    const loadChapterSegments = vi.fn(async () => readerPageSegments)
    const { rerender, context } = renderMeasurer({ loadChapterSegments })
    await screen.findByTestId('chapter-layout')
    finishMeasurement()
    const reportChapterMeasurement =
      vi.mocked(ReaderChapterLayout).mock.lastCall![0].onPageMeasure

    rerender({ readyChapterIds: new Set() })

    expect(vi.mocked(ReaderChapterLayout).mock.lastCall![0].onPageMeasure).toBe(
      reportChapterMeasurement,
    )
    expect(loadChapterSegments).toHaveBeenCalledTimes(1)

    finishMeasurement()

    expect(context.navigation.reportPageMeasurement).toHaveBeenCalledTimes(1)

    rerender({ retryKey: 1 })
    await screen.findByTestId('chapter-layout')
    finishMeasurement()

    expect(context.navigation.reportPageMeasurement).toHaveBeenCalledTimes(2)
    expect(loadChapterSegments).toHaveBeenCalledTimes(2)
  })

  it('ignores a late load after switching books', async () => {
    let resolveOldLoad!: (segments: ReaderSegment[]) => void
    const oldLoad = new Promise<ReaderSegment[]>((resolve) => {
      resolveOldLoad = resolve
    })
    const loadChapterSegments = vi
      .fn()
      .mockReturnValueOnce(oldLoad)
      .mockResolvedValueOnce([])
    const { rerender } = renderMeasurer({ loadChapterSegments })

    rerender({ bookId: 8, contentVersion: 'other' })
    await screen.findByTestId('chapter-layout')
    await act(async () => {
      resolveOldLoad(readerPageSegments)
    })

    expect(vi.mocked(ReaderChapterLayout).mock.lastCall![0].segments).toEqual(
      [],
    )
    expect(loadChapterSegments).toHaveBeenCalledTimes(2)
  })

  it('surfaces a load failure without retrying', async () => {
    class LoadFailureBoundary extends Component<
      { children: ReactNode },
      { hasError: boolean }
    > {
      state = { hasError: false }

      static getDerivedStateFromError() {
        return { hasError: true }
      }

      render() {
        return this.state.hasError ? (
          <p role="alert">Chapter load failed</p>
        ) : (
          this.props.children
        )
      }
    }

    const loadChapterSegments = vi
      .fn()
      .mockRejectedValue(new Error('read failed'))
    const context = createContextValue()
    render(
      <LoadFailureBoundary>
        <ReaderContext value={context}>
          <PageMeasurer
            bookId={7}
            contentVersion="version"
            chapterIds={['first']}
            availableChapterIds={new Set(['first'])}
            readyChapterIds={new Set()}
            layoutKey="layout"
            loadChapterSegments={loadChapterSegments}
          />
        </ReaderContext>
      </LoadFailureBoundary>,
      { onCaughtError: vi.fn() },
    )

    await screen.findByRole('alert')

    expect(loadChapterSegments).toHaveBeenCalledTimes(1)
    expect(ReaderChapterLayout).not.toHaveBeenCalled()
  })

  it('waits when the requested input is no longer available', async () => {
    const loadChapterSegments = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderMeasurer({ loadChapterSegments })
    await waitFor(() => expect(loadChapterSegments).toHaveBeenCalledTimes(1))

    rerender({ readyChapterIds: new Set() })

    expect(screen.queryByTestId('chapter-layout')).not.toBeInTheDocument()
    expect(loadChapterSegments).toHaveBeenCalledTimes(1)
  })
})
