import Dexie, { type EntityTable } from 'dexie'
import type { StoredAudioRecording } from '../models/recording'

type VoiceArchiveDatabase = Dexie & {
  recordings: EntityTable<StoredAudioRecording, 'id'>
}

export const database = new Dexie('voice-archive') as VoiceArchiveDatabase

// Version 1 matches databases created before Dexie was introduced.
database.version(1).stores({
  recordings: 'id',
})

// createdAt is indexed so recent recordings can be read without loading and
// sorting the entire collection in memory.
database.version(2).stores({
  recordings: 'id, createdAt',
})
