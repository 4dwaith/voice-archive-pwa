import { createContext, useContext } from 'react'
import type {
  ReaderSegmentError,
  ReaderTocPresentation,
} from '../models/reader'

export type ReaderContextValue = {
  selectedSectionId: number | null
  isSectionExpanded: (sectionId: number) => boolean
  tocPresentation: ReaderTocPresentation
  selectSection: (sectionId: number | null) => void
  setSectionExpanded: (change: {
    sectionId: number
    isExpanded: boolean
  }) => void
  setTocPresentation: (presentation: ReaderTocPresentation) => void
  currentPage: number
  pageCount: number | null
  textSizePercent: number
  setCurrentPage: (pageNumber: number) => void
  reportPageCount: (pageCount: number | null) => void
  selectedSegmentId: number | null
  highlightedSegmentId: number | null
  selectSegment: (segmentId: number | null) => void
  highlightSegment: (segmentId: number | null) => void
  reportSegmentError: (report: {
    segmentId: number
    error: ReaderSegmentError | null
  }) => void
}

export const ReaderContext = createContext<ReaderContextValue | null>(null)

export function useReaderContext(): ReaderContextValue {
  const context = useContext(ReaderContext)
  if (context === null) {
    throw new Error('useReaderContext requires a ReaderProvider')
  }
  return context
}
