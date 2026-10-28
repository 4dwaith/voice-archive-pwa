import { database } from '../../src/data/database'
import {
  readerBookContent,
  readerBookSection,
  readerBookSegment,
} from '../../src/mock-data/readerBook'

// Scenario-owned records: seed idempotently, retaining committed measurements.
export async function seedReaderBook(bookId: number, hasChapter = false) {
  await database.open()
  await database.transaction(
    'rw',
    [database.content, database.sections, database.segments],
    async () => {
      await database.content.put({
        ...readerBookContent,
        bookId,
        manifest: {
          ...readerBookContent.manifest,
          section_count: hasChapter ? 1 : 0,
        },
      })
      if (hasChapter)
        await database.sections.put({ ...readerBookSection, bookId })
      await database.segments.put({
        ...readerBookSegment,
        bookId,
        section_id: hasChapter ? readerBookSection.id : null,
        root_section_id: hasChapter ? readerBookSection.id : null,
      })
    },
  )
}
