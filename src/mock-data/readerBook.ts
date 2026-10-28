import type {
  CachedContent,
  CachedSection,
  CachedSegment,
} from '../models/content'
import { continuingReaderSegment } from './readerPages'

export const readerBookContent: CachedContent = {
  bookId: 91001,
  version: 'reader-story-1',
  complete: true,
  manifest: {
    state: 'published',
    content_version: 'reader-story-1',
    schema_version: 1,
    imported_at: '2026-10-28T00:00:00Z',
    source_pdf_file_id: null,
    section_count: 0,
    segment_count: 1,
    files: [],
  },
}

export const readerBookSection: CachedSection = {
  bookId: 91001,
  version: 'reader-story-1',
  id: 1,
  parent_id: null,
  sequence: 0,
  sibling_sequence: 0,
  source_key: 'chapter',
  title: 'Chapter',
  kind: 'chapter',
  audio_file_id: null,
  first_segment_source_key: continuingReaderSegment.source_key,
}

export const readerBookSegment: CachedSegment = {
  ...continuingReaderSegment,
  bookId: 91001,
  version: 'reader-story-1',
  sequence: 0,
  section_id: null,
  root_section_id: null,
  regions: [],
  page_indexes: [],
  narration_start_ms: null,
  narration_end_ms: null,
  narration_seek_ms: null,
  alignment_status: null,
  alignment_metadata: null,
}
