import { createContext, useContext } from 'react'
import type {
  ReaderPageNavigation,
  ReaderPageMeasurement,
  ReaderSegmentError,
  ReaderTocPresentation,
} from '../models/reader'

export type ReaderContextValue = {
  toc: {
    selectedSectionId: number | null
    isSectionExpanded: (sectionId: number) => boolean
    tocPresentation: ReaderTocPresentation
    selectSection: (sectionId: number | null) => void
    setSectionExpanded: (change: {
      sectionId: number
      isExpanded: boolean
    }) => void
    setTocPresentation: (presentation: ReaderTocPresentation) => void
  }
  navigation: {
    pageScope: ReaderPageNavigation['scope']
    setPageScope: (scope: ReaderPageNavigation['scope']) => void
    currentPage: number
    pageCount: number | null
    globalPage: number | null
    totalPageCount: number | null
    indexedPageCount: number
    isPageNavigationPending: boolean
    requestPageNavigation: (intent: ReaderPageNavigation) => void
    setCurrentPage: (pageNumber: number) => void
    reportPageMeasurement: (report: ReaderPageMeasurement) => void
    reportPageCount: (pageCount: number | null) => void
  }
  reader: {
    textSizePercent: number
    selectedSegmentId: number | null
    highlightedSegmentId: number | null
    selectSegment: (segmentId: number | null) => void
    highlightSegment: (segmentId: number | null) => void
    reportSegmentError: (report: {
      segmentId: number
      error: ReaderSegmentError | null
    }) => void
  }
}

export const ReaderContext = createContext<ReaderContextValue | null>(null)

export function useReaderContext(): ReaderContextValue {
  const context = useContext(ReaderContext)
  if (context === null) {
    throw new Error('useReaderContext requires a ReaderProvider')
  }
  return context
}
