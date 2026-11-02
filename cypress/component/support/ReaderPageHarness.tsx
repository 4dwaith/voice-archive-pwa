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
  ReaderChapterMeasurement,
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../../../src/models/reader'

export type ReaderPageInputs = Pick<
  ReaderContextValue['navigation'],
  'currentPage' | 'pageCount'
> &
  Pick<ReaderContextValue['reader'], 'textSizePercent' | 'selectedSegmentId'>

export type ReaderPageControls = {
  updateContext: (updates: Partial<ReaderPageInputs>) => void
}

export function ReaderPageHarness({
  segments,
  width,
  height,
  pageCount,
  ref,
  onLayoutKeyChange,
  onPageMeasure,
  onReportPageMeasurement,
  children,
  layoutOnly = false,
}: {
  segments: ReaderSegment[]
  width: number
  height: number
  pageCount: number | null
  ref: Ref<ReaderPageControls>
  children?: ReactNode
  layoutOnly?: boolean
  onReportPageMeasurement?: (report: ReaderChapterMeasurement) => void
  onPageMeasure?: (report: ReaderLayoutMeasurement) => void
  onLayoutKeyChange?: (key: string | null) => void
}) {
  const [inputs, setInputs] = useState<ReaderPageInputs>({
    currentPage: 1,
    pageCount,
    textSizePercent: 100,
    selectedSegmentId: null,
  })
  const [measurement, setMeasurement] = useState<ReaderLayoutMeasurement>()
  const reportLayoutMeasurement = useCallback(
    (report: ReaderLayoutMeasurement) => {
      setMeasurement(report)
      onPageMeasure?.(report)
    },
    [onPageMeasure],
  )

  const [layoutKey, setLayoutKey] = useState<string | null>(null)
  const reportLayoutKey = useCallback(
    (key: string | null) => {
      setLayoutKey(key)
      onLayoutKeyChange?.(key)
    },
    [onLayoutKeyChange],
  )

  const reportPageMeasurement = useCallback(
    (report: ReaderChapterMeasurement) => onReportPageMeasurement?.(report),
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

  const hasCurrentMeasurement =
    layoutKey !== null && measurement?.layoutKey === layoutKey

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
      pageCount: inputs.pageCount,
      reportPageMeasurement,
      setCurrentPage: (currentPage) =>
        setInputs((previous) => ({ ...previous, currentPage })),
    },
    reader: {
      areControlsVisible: true,
      setControlsVisible: () => undefined,
      textSizePercent: inputs.textSizePercent,
      selectedSegmentId: inputs.selectedSegmentId,
      highlightedSegmentId: null,
      selectSegment: () => undefined,
      highlightSegment: () => undefined,
      reportLayoutKey,
      reportSegmentError: () => undefined,
    },
  }

  return (
    <ReaderContext value={value}>
      <div
        data-reader-host
        data-reader-layout-key={layoutKey ?? undefined}
        data-reader-layout-host={layoutOnly || undefined}
        data-layout-page={layoutOnly ? inputs.currentPage : undefined}
        data-layout-page-count={
          layoutOnly && hasCurrentMeasurement
            ? measurement.pages.length
            : undefined
        }
        data-layout-ready={layoutOnly ? hasCurrentMeasurement : undefined}
        style={{ width, height, fontFamily: 'monospace' }}
      >
        {children ??
          (layoutOnly ? (
            <ReaderChapterLayout
              segments={segments}
              page={inputs.currentPage}
              textSizePercent={inputs.textSizePercent}
              onLayoutKeyChange={reportLayoutKey}
              shouldMeasure
              onPageMeasure={reportLayoutMeasurement}
            />
          ) : (
            <ReaderPage segments={segments} label="A synthetic chapter" />
          ))}
      </div>
    </ReaderContext>
  )
}
