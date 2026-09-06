import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../data/database'
import { maximumRecordingHistory } from '../models/recording'

export function useRecordings() {
  const storedRecordings = useLiveQuery(
    () =>
      database.recordings
        .orderBy('createdAt')
        .reverse()
        .limit(maximumRecordingHistory)
        .toArray(),
    [],
  )

  const recordings = useMemo(
    () =>
      storedRecordings?.map(({ blob, ...recording }) => ({
        ...recording,
        audioUrl: URL.createObjectURL(blob),
      })) ?? [],
    [storedRecordings],
  )

  useEffect(
    () => () => {
      recordings.forEach(({ audioUrl }) => URL.revokeObjectURL(audioUrl))
    },
    [recordings],
  )

  return {
    recordings,
    isLoading: storedRecordings === undefined,
  }
}

export function useRecordingCount() {
  return useLiveQuery(() => database.recordings.count(), [], 0)
}
