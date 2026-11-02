import { createContext, useContext } from 'react'
import type { Region } from '../api-client/generated/endpoints'
import type { TextSearchResult } from '../data/searchBookText'
import type {
  ReaderPageNavigationRequest,
  ReaderChapterMeasurement,
  ReaderSegmentError,
  ReaderTocPresentation,
} from '../models/reader'

export type ReaderSearchValue = {
  results: TextSearchResult[]
  resultsQuery: string
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  isOpen: boolean
  submitQuery: (query: string) => void
  setOpen: (isOpen: boolean) => void
  clear: () => void
  openResult: (result: TextSearchResult) => void
}
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
    pageScope: ReaderPageNavigationRequest['scope']
    setPageScope: (scope: ReaderPageNavigationRequest['scope']) => void
    currentPage: number
    pageCount: number | null
    globalPage: number | null
    totalPageCount: number | null
    indexedPageCount: number
    isPageNavigationPending: boolean
    requestPageNavigation: (intent: ReaderPageNavigationRequest) => void
    setCurrentPage: (pageNumber: number) => void
    reportPageMeasurement: (report: ReaderChapterMeasurement) => void
  }
  reader: {
    pdf?: {
      scopeKey: string
      url: string | null
      regions: Region[]
      viewMode: 'text' | 'pdf' | 'both'
      setViewMode: (mode: 'text' | 'pdf' | 'both') => void
    }
    search?: ReaderSearchValue
    areControlsVisible: boolean
    setControlsVisible: (isVisible: boolean) => void
    reportLayoutKey: (key: string | null) => void
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
