import Dexie from 'dexie'
import { database } from './database'
import type { CachedContent, CachedSection } from '../models/content'

export async function deleteLocalContent(bookId: number) {
  await database.transaction(
    'rw',
    [
      database.content,
      database.sections,
      database.segments,
      database.measurements,
    ],
    async () => {
      await database.content.delete(bookId)

      await database.sections.where('bookId').equals(bookId).delete()
      await database.segments.where('bookId').equals(bookId).delete()

      await database.measurements.where('bookId').equals(bookId).delete()
    },
  )
}

export async function initializeContentStaging(record: CachedContent) {
  await database.transaction(
    'rw',
    [
      database.content,
      database.sections,
      database.segments,
      database.measurements,
    ],
    async () => {
      await database.sections.where('bookId').equals(record.bookId).delete()
      await database.segments.where('bookId').equals(record.bookId).delete()
      await database.measurements.where('bookId').equals(record.bookId).delete()

      await database.content.put(record)
    },
  )
}

export async function getContentSections(
  bookId: number,
): Promise<CachedSection[]> {
  const content = await database.content.get(bookId)

  return content
    ? database.sections
        .where('[bookId+version+sequence]')
        .between(
          [bookId, content.version, 0],
          [bookId, content.version, Dexie.maxKey],
          true,
          true,
        )
        .toArray()
    : []
}

// Section IDs are positive; zero denotes the reader's leading Before text.
export async function getSectionFirstSegment(
  bookId: number,
  version: string,
  sectionId: number,
) {
  if (sectionId === 0)
    return database.segments
      .where('[bookId+version]')
      .equals([bookId, version])
      .first()

  const section = await database.sections.get([bookId, version, sectionId])
  return section?.first_segment_source_key
    ? database.segments
        .where('[bookId+version+source_key]')
        .equals([bookId, version, section.first_segment_source_key])
        .first()
    : undefined
}
