import type { StoredAudioRecording } from '../models/recording'
import { database } from './database'

export async function saveStoredRecording(
  recording: StoredAudioRecording,
  limit: number,
) {
  await database.transaction('rw', database.recordings, async () => {
    await database.recordings.put(recording)

    const expiredRecordingIds = await database.recordings
      .orderBy('createdAt')
      .reverse()
      .offset(limit)
      .primaryKeys()

    await database.recordings.bulkDelete(expiredRecordingIds)
  })
}
