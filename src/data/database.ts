import Dexie, { type EntityTable, type Table } from 'dexie'
import type { StoredAudioRecording } from '../models/recording'
import type { StoredReaderMeasurement } from '../models/reader'
import type {
  CachedContent,
  CachedSection,
  CachedSegment,
  SavedContentPosition,
} from '../models/content'

type VoiceArchiveDatabase = Dexie & {
  recordings: EntityTable<StoredAudioRecording, 'id'>
  content: EntityTable<CachedContent, 'bookId'>
  sections: Table<CachedSection, [number, string, number]>
  segments: Table<CachedSegment, [number, string, number]>
  contentPositions: EntityTable<SavedContentPosition, 'bookId'>
  measurements: Table<StoredReaderMeasurement, [number, string, string, string]>
}

export const database = new Dexie(
  import.meta.env.VITE_DATABASE_NAME || 'voice-archive',
) as VoiceArchiveDatabase

// Version 1 matches databases created before Dexie was introduced.
database.version(1).stores({
  recordings: 'id',
})

// createdAt is indexed so recent recordings can be read without loading and
// sorting the entire collection in memory.
database.version(2).stores({
  recordings: 'id, createdAt',
})

database.version(3).stores({
  recordings: 'id, createdAt',
  content: 'bookId',
  sections:
    '[bookId+version+id], bookId, [bookId+version], [bookId+version+source_key]',
  segments:
    '[bookId+version+sequence], bookId, [bookId+version], [bookId+version+section_id], [bookId+version+source_key]',
  contentPositions: 'bookId',
})

// Earlier cached sections did not include their import-time reading sequence.
// Refetch that projection while retaining recordings and logical positions.
database
  .version(4)
  .stores({
    sections:
      '[bookId+version+id], bookId, [bookId+version], [bookId+version+sequence], [bookId+version+source_key]',
  })
  .upgrade(async (transaction) => {
    await transaction.table('content').clear()
    await transaction.table('sections').clear()
    await transaction.table('segments').clear()
  })

// Root ownership is now stored on segments for indexed reader queries.
// Refetch older projections; preserve recordings and saved logical positions.
database
  .version(5)
  .stores({
    segments:
      '[bookId+version+sequence], bookId, [bookId+version], [bookId+version+section_id], [bookId+version+source_key], [bookId+version+root_section_id+sequence]',
  })
  .upgrade(async (transaction) => {
    await transaction.table('content').clear()
    await transaction.table('sections').clear()
    await transaction.table('segments').clear()
  })

// Derived measurements do not invalidate canonical content or legacy user data.
database.version(6).stores({
  measurements:
    '[bookId+contentVersion+chapterId+layoutKey], bookId, [bookId+contentVersion+layoutKey]',
})

// Indexed anchor lookup preserves existing content and measurements.
database.version(7).stores({
  segments:
    '[bookId+version+sequence], bookId, [bookId+version], [bookId+version+id], [bookId+version+section_id], [bookId+version+source_key], [bookId+version+root_section_id+sequence]',
})
