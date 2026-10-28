import { database } from '../../src/data/database'
import type { StoredReaderMeasurement } from '../../src/models/reader'
import type { CachedContent } from '../../src/models/content'

export function createMeasurement(): StoredReaderMeasurement {
  return {
    bookId: 7,
    contentVersion: 'version',
    chapterId: '10',
    layoutKey: 'layout',
    width: 320,
    height: 212,
    textSizePercent: 100,
    pages: [
      {
        localPage: 1,
        start: { segmentId: 1, sourceKey: 'text', offset: 0 },
        end: { segmentId: 1, sourceKey: 'text', offset: 3 },
      },
    ],
    unmappableSegmentIds: [2],
  }
}

export async function seedContent() {
  const content: CachedContent = {
    bookId: 7,
    version: 'version',
    complete: true,
    manifest: {
      state: 'published',
      content_version: 'version',
      schema_version: 1,
      imported_at: '2026-10-28T00:00:00Z',
      source_pdf_file_id: null,
      section_count: 1,
      segment_count: 2,
      files: [],
    },
  }
  await database.content.put(content)
  await database.sections.put({
    bookId: 7,
    version: 'version',
    id: 10,
    parent_id: null,
    sequence: 0,
    sibling_sequence: 0,
    source_key: 'root',
    title: 'Root',
    kind: 'chapter',
    audio_file_id: null,
    first_segment_source_key: 'text',
  })
  await database.segments.bulkPut(
    [1, 2].map((id) => ({
      bookId: 7,
      version: 'version',
      id,
      sequence: id * 3,
      source_key: id === 1 ? 'text' : 'unmappable',
      section_id: 10,
      root_section_id: 10,
      kind: 'prose' as const,
      html_content: '<p>abc</p>',
      text_content: id === 1 ? 'abc' : 'invalid',
      language: null,
      regions: [],
      page_indexes: [],
      narration_start_ms: null,
      narration_end_ms: null,
      narration_seek_ms: null,
      alignment_status: null,
      alignment_metadata: null,
    })),
  )
  return content
}
