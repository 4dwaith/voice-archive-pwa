import { useCallback, useImperativeHandle, useState, type Ref } from 'react'
import { ReaderPage } from '../../../src/components/atoms/ReaderPage/ReaderPage'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import type { ReaderSegment } from '../../../src/models/reader'

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
}: {
  segments: ReaderSegment[]
  width: number
  height: number
  ref: Ref<ReaderPageControls>
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
      <div data-reader-host style={{ width, height, fontFamily: 'monospace' }}>
        <ReaderPage segments={segments} label="A synthetic chapter" />
      </div>
    </ReaderContext>
  )
}
