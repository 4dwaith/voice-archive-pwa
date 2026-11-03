import { z } from 'zod'
import { MAX_TEXT_SIZE_STEP } from '../store/textSizeSlice'

export const READER_PREFERENCES_KEY =
  import.meta.env.VITE_READER_PREFERENCES_KEY || 'voice-archive-reader'

const positionSchema = z.object({
  version: z.string().min(1),
  sourceKey: z.string().min(1),
  offset: z.number().int().nonnegative(),
})

const preferencesSchema = z.object({
  viewMode: z.enum(['text', 'pdf']).optional().catch(undefined),
  textSizeStep: z.number().int().min(0).max(MAX_TEXT_SIZE_STEP).catch(0),
  positions: z
    .record(
      z.string().regex(/^[1-9]\d*$/),
      positionSchema.optional().catch(undefined),
    )
    .catch({}),
})

export type ReaderPreferences = {
  viewMode?: 'text' | 'pdf'
  textSizeStep: number
  positions: Record<string, z.infer<typeof positionSchema>>
}

export function readReaderPreferences(): ReaderPreferences {
  try {
    const value = preferencesSchema.parse(
      JSON.parse(localStorage.getItem(READER_PREFERENCES_KEY) ?? '{}'),
    )
    return {
      ...value,
      positions: Object.fromEntries(
        Object.entries(value.positions).flatMap(([bookId, position]) =>
          position ? [[bookId, position]] : [],
        ),
      ),
    }
  } catch {
    return { textSizeStep: 0, positions: {} }
  }
}

export function writeReaderPreferences(preferences: ReaderPreferences) {
  try {
    localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Storage availability must never prevent reading.
  }
}
