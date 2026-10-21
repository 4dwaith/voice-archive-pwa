import type { BookResponseOutput } from '../api/generated/schemas'

// Presentation data only. Server book entities come from generated schemas.
export type BookCardModel = Pick<BookResponseOutput, 'id' | 'title'> & {
  coverImage?: string
  mark: string
}
