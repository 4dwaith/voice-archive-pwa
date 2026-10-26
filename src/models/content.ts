import type {
  ContentManifestOutput,
  SectionReadOutput,
  SegmentReadOutput,
} from '../api-client/generated/schemas'

export type ContentDownloadProgress = {
  // Zero starts a stream; null means its last batch has committed.
  sectionNextOffset: number | null
  segmentNextOffset: number | null
  lastSegmentSequence: number | null
}

export type CachedContent = {
  bookId: number
  version: string
  manifest: ContentManifestOutput
  complete: boolean
  // Older complete caches remain reusable; incomplete caches without checkpoints
  // are restarted once because their committed offsets were never recorded.
  progress?: ContentDownloadProgress
}
export type CachedSection = SectionReadOutput & {
  bookId: number
  version: string
}
export type CachedSegment = SegmentReadOutput & {
  root_section_id: number | null
  bookId: number
  version: string
}
export type SavedContentPosition = {
  bookId: number
  version: string
  sourceKey: string
  offset: number
}
