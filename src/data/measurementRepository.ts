import { database } from './database'
import type { StoredReaderMeasurement } from '../models/reader'

export async function saveChapterMeasurement(
  measurement: StoredReaderMeasurement,
): Promise<'saved' | 'rejected'> {
  return database.transaction(
    'rw',
    [database.content, database.sections, database.measurements],
    async () => {
      const content = await database.content.get(measurement.bookId)
      // Until progressive chapter queries arrive in 11.9, require both streams
      // to have ended. A nonempty array alone never proves a complete input.
      const hasCompleteInput =
        content?.complete ||
        (content?.progress?.sectionNextOffset === null &&
          content?.progress?.segmentNextOffset === null)
      if (
        !hasCompleteInput ||
        content?.version !== measurement.contentVersion ||
        !measurement.layoutKey ||
        ![
          measurement.width,
          measurement.height,
          measurement.textSizePercent,
        ].every((value) => Number.isFinite(value) && value > 0)
      )
        return 'rejected'

      // Chapter identity is the root ID as a string, or the leading Before chapter.
      if (measurement.chapterId !== 'before') {
        const sectionId = Number(measurement.chapterId)
        if (
          !Number.isSafeInteger(sectionId) ||
          String(sectionId) !== measurement.chapterId
        )
          return 'rejected'
        const root = await database.sections.get([
          measurement.bookId,
          measurement.contentVersion,
          sectionId,
        ])
        if (
          !root ||
          root.parent_id !== null ||
          String(root.id) !== measurement.chapterId
        )
          return 'rejected'
      }
      await database.measurements.put(measurement)
      return 'saved'
    },
  )
}
