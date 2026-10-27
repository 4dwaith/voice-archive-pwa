import {
  useCallback,
  useImperativeHandle,
  useState,
  type Ref,
  type ReactNode,
} from 'react'
import { ReaderChapterLayout } from '../../../src/components/atoms/ReaderChapterLayout/ReaderChapterLayout'
import { ReaderPage } from '../../../src/components/atoms/ReaderPage/ReaderPage'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import type {
  ReaderPageMeasurement,
  ReaderSegment,
} from '../../../src/models/reader'

export type ReaderPageInputs = Pick<
  ReaderContextValue['navigation'],
  'currentPage'
> &
  Pick<ReaderContextValue['reader'], 'textSizePercent' | 'selectedSegmentId'>

export type ReaderPageControls = {
  updateContext: (updates: Partial<ReaderPageInputs>) => void
}

export function ReaderPageHarness({
  segments,
  width,
  height,
  ref,
  onReportPageCount,
  onReportPageMeasurement,
  children,
  layoutOnly = false,
}: {
  segments: ReaderSegment[]
  width: number
  height: number
  ref: Ref<ReaderPageControls>
  children?: ReactNode
  layoutOnly?: boolean
  onReportPageMeasurement?: (report: ReaderPageMeasurement) => void
  onReportPageCount?: (count: number | null) => void
}) {
  const [inputs, setInputs] = useState<ReaderPageInputs>({
    currentPage: 1,
    textSizePercent: 100,
    selectedSegmentId: null,
  })
  const [pageCount, setPageCount] = useState<number | null>(null)
  const reportPageCount = useCallback(
    (count: number | null) => {
      onReportPageCount?.(count)
      setPageCount(count)
    },
    [onReportPageCount],
  )

  const reportPageMeasurement = useCallback(
    (report: ReaderPageMeasurement) => onReportPageMeasurement?.(report),
    [onReportPageMeasurement],
  )

  useImperativeHandle(
    ref,
    () => ({
      updateContext(updates) {
        setInputs((previous) => ({ ...previous, ...updates }))
      },
    }),
    [],
  )

  const value: ReaderContextValue = {
    toc: {
      selectedSectionId: null,
      isSectionExpanded: () => true,
      tocPresentation: 'shown',
      selectSection: () => undefined,
      setSectionExpanded: () => undefined,
      setTocPresentation: () => undefined,
    },
    navigation: {
      pageScope: 'local',
      setPageScope: () => undefined,
      globalPage: null,
      totalPageCount: null,
      indexedPageCount: 0,
      isPageNavigationPending: false,
      requestPageNavigation: () => undefined,
      currentPage: inputs.currentPage,
      pageCount,
      reportPageCount,
      reportPageMeasurement,
      setCurrentPage: (currentPage) =>
        setInputs((previous) => ({ ...previous, currentPage })),
    },
    reader: {
      textSizePercent: inputs.textSizePercent,
      selectedSegmentId: inputs.selectedSegmentId,
      highlightedSegmentId: null,
      selectSegment: () => undefined,
      highlightSegment: () => undefined,
      reportSegmentError: () => undefined,
    },
  }

  return (
    <ReaderContext value={value}>
      <div
        data-reader-host
        data-reader-layout-host={layoutOnly || undefined}
        data-layout-page={layoutOnly ? inputs.currentPage : undefined}
        data-layout-page-count={
          layoutOnly ? (pageCount ?? undefined) : undefined
        }
        data-layout-ready={layoutOnly ? pageCount !== null : undefined}
        style={{ width, height, fontFamily: 'monospace' }}
      >
        {children ??
          (layoutOnly ? (
            <ReaderChapterLayout
              segments={segments}
              page={inputs.currentPage}
              textSizePercent={inputs.textSizePercent}
              shouldCount
              reportPageCount={reportPageCount}
            />
          ) : (
            <ReaderPage segments={segments} label="A synthetic chapter" />
          ))}
      </div>
    </ReaderContext>
  )
}
