import { database } from './database'
import { readChapterAvailability } from './readerChapterRepository'
import type { StoredReaderMeasurement } from '../models/reader'

export async function saveChapterMeasurement(
  measurement: StoredReaderMeasurement,
): Promise<'saved' | 'rejected'> {
  return database.transaction(
    'rw',
    [
      database.content,
      database.sections,
      database.segments,
      database.measurements,
    ],
    async () => {
      const chapterAvailability = await readChapterAvailability(
        measurement.bookId,
        measurement.contentVersion,
      )

      if (
        !chapterAvailability?.downloadedChapterRanges.has(
          measurement.chapterId,
        ) ||
        !measurement.layoutKey ||
        ![
          measurement.width,
          measurement.height,
          measurement.textSizePercent,
        ].every((value) => Number.isFinite(value) && value > 0)
      )
        return 'rejected'

      await database.measurements.put(measurement)
      return 'saved'
    },
  )
}
