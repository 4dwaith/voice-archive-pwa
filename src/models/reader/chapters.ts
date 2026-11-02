import type { CachedSection } from '../content'
import type { StoredReaderMeasurement } from './measurements'

// Locate and load chapter text using half-open bounds in canonical segment order.
export type ReaderChapterRange = {
  startSegmentSequenceNumber: number
  endSegmentSequenceNumber: number
}

// Describe downloaded chapter text so reading and measurement avoid download gaps.
export type BookDownloadStatus = {
  sections: CachedSection[]
  chapterIds: string[]
  downloadedChapterRanges: Map<string, ReaderChapterRange>
  hasCompleteContent: boolean
}

// Committed measurements for chapters
type BookMeasurementStatus = {
  measurementsByChapter: Map<string, StoredReaderMeasurement>
  availableChapterIds: Set<string>
  readyChapterIds: Set<string>
  countsByChapter: Map<string, number>

  // Only these chapters that have all chapters before them measured have book-wide page numbers.
  indexedChapterIds: string[]
  indexedPageCount: number

  // Unknown until every chapter has been downloaded and measured.
  totalPageCount: number | null
}

// Combine available chapters with committed measurements to derive navigation bounds.
export type ReaderBookStatus = BookDownloadStatus & BookMeasurementStatus
