import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { database } from '../../src/data/database'
import {
  deleteLocalContent,
  getContentSections,
} from '../../src/data/contentRepository'
import { buildSectionHierarchyIndexes } from '../../src/utils/contentHierarchy'
import type { CachedSection, CachedSegment } from '../../src/models/content'

const bookId = 7
const version = 'a3027b66-924c-4c9a-aad5-660ba7a733bc'

function createCachedSection(
  id: number,
  parent_id: number | null,
  sequence: number,
): CachedSection {
  return {
    bookId,
    version,
    id,
    parent_id,
    sequence,
    source_key: `section-${id}`,
    kind: 'section',
    title: `Section ${id}`,
    sibling_sequence: sequence,
    audio_file_id: null,
    first_segment_source_key: null,
  }
}

async function seedCachedContent(segmentCount = 7) {
  await database.content.put({
    bookId,
    version,
    complete: true,
    manifest: {
      state: 'published',
      content_version: version,
      schema_version: 1,
      imported_at: '2026-10-23T00:00:00Z',
      source_pdf_file_id: null,
      section_count: 5,
      segment_count: segmentCount,
      files: [],
    },
  })

  // ID order differs from preorder. Roots, children, and grandchild come from DB sequence order.
  await database.sections.bulkAdd([
    createCachedSection(30, 200, 25),
    createCachedSection(20, 10, 10),
    createCachedSection(100, null, 0),
    createCachedSection(200, null, 20),
    createCachedSection(10, 100, 5),
  ])

  const owners = [10, 20, 30, null, 100, 200, 10]
  const segments: CachedSegment[] = Array.from(
    { length: segmentCount },
    (_, index) => ({
      bookId,
      version,
      id: index + 1,
      source_key: `segment-${index}`,
      sequence: index * 3,
      section_id: owners[index % owners.length],
      root_section_id: [100, 100, 200, null, 100, 200, 100][
        index % owners.length
      ],
      kind: 'prose',
      html_content: '<p>Some text</p>',
      text_content: 'Some text',
      language: null,
      regions: [],
      page_indexes: [],
      narration_start_ms: null,
      narration_end_ms: null,
      narration_seek_ms: null,
      alignment_status: null,
      alignment_metadata: null,
    }),
  )

  await database.segments.bulkAdd(segments)
}

it('uses the configured test database', () => {
  expect(database.name).toBe('voice-archive-test')
})

beforeEach(async () => {
  await database.delete()
  await database.open()
})
afterEach(async () => {
  await database.delete()
})

it('gets section preorder directly from the database index', async () => {
  await seedCachedContent()
  const sections = await getContentSections(bookId)

  expect(sections.map((section) => section.id)).toEqual([100, 10, 20, 200, 30])
  expect(buildSectionHierarchyIndexes(sections).roots.get(20)?.id).toBe(100)
  expect(buildSectionHierarchyIndexes(sections).roots.get(30)?.id).toBe(200)
})

it('removes only the selected book content', async () => {
  await seedCachedContent()
  await database.content.put({
    ...(await database.content.get(bookId))!,
    bookId: 99,
  })

  await deleteLocalContent(bookId)

  expect(await database.sections.count()).toBe(0)
  expect(await database.segments.count()).toBe(0)
  expect(await database.content.get(99)).toBeDefined()
})
