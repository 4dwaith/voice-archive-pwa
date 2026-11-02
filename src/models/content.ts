import type {
  ContentManifestOutput,
  SectionReadOutput,
  SegmentReadOutput,
} from '../api-client/generated/schemas'

// Track committed stream offsets so interrupted content downloads can resume.
export type ContentDownloadProgress = {
  // Zero starts a stream; null means its last batch has committed.
  sectionNextOffset: number | null
  segmentNextOffset: number | null
  lastSegmentSequence: number | null
}

// Keep a versioned manifest and download completion state for offline reads.
export type CachedContent = {
  bookId: number
  version: string
  manifest: ContentManifestOutput
  complete: boolean
  // Older complete caches remain reusable; incomplete caches without checkpoints
  // are restarted once because their committed offsets were never recorded.
  progress?: ContentDownloadProgress
}

// Scope imported section metadata to its cached book and content version.
export type CachedSection = SectionReadOutput & {
  bookId: number
  version: string
}

// Store canonical segment data with book/version identity and root chapter ownership.
export type CachedSegment = SegmentReadOutput & {
  root_section_id: number | null
  bookId: number
  version: string
}
