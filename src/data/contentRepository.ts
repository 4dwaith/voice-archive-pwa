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
      database.contentPositions,
    ],
    async () => {
      await database.content.delete(bookId)

      await database.sections.where('bookId').equals(bookId).delete()
      await database.segments.where('bookId').equals(bookId).delete()

      await database.contentPositions.delete(bookId)
    },
  )
}

export async function initializeContentStaging(record: CachedContent) {
  await database.transaction(
    'rw',
    [database.content, database.sections, database.segments],
    async () => {
      await database.sections.where('bookId').equals(record.bookId).delete()
      await database.segments.where('bookId').equals(record.bookId).delete()

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
