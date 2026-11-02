// Identify which chapter and layout a measurement report belongs to.
export type ReaderMeasurementTarget = { chapterId: string; layoutKey: string }

// Keep source keys on measured page boundaries so stale segment matches are rejected.
type ReaderTextPosition = {
  segmentId: number
  sourceKey: string
  offset: number
}

// Describe page boundaries and unmappable text produced by one layout pass.
export type ReaderLayoutMeasurement = {
  layoutKey: string
  width: number
  height: number
  textSizePercent: number
  pages: {
    localPage: number
    start: ReaderTextPosition | null
    end: ReaderTextPosition | null
  }[]
  unmappableSegmentIds: number[]
}

// Attach chapter identity to layout output before reporting it through context.
export type ReaderChapterMeasurement = ReaderMeasurementTarget &
  ReaderLayoutMeasurement

// Add book/version identity so chapter measurements can be cached, validated, and queried from the database.
export type StoredReaderMeasurement = ReaderChapterMeasurement & {
  bookId: number
  contentVersion: string
}

// Expose a measurement save's identity and outcome for failure feedback and retry.
export type ReaderMeasurementSave = Pick<
  StoredReaderMeasurement,
  'bookId' | 'contentVersion' | 'chapterId' | 'layoutKey'
> & {
  outcome: 'saved' | 'rejected' | 'failed' | null
}
