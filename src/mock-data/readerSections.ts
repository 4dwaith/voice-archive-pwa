import type { ReaderSection } from '../models/reader'

// Shared synthetic example for stories and independent component checks.
export const readerSections: ReaderSection[] = [
  { id: 1, parent_id: null, title: 'Part one', sequence: 1 },
  { id: 2, parent_id: 1, title: 'Beginning', sequence: 2 },
  { id: 3, parent_id: 2, title: 'A closer look', sequence: 3 },
  { id: 4, parent_id: 3, title: 'Another level', sequence: 4 },
  { id: 5, parent_id: 4, title: 'ಕನ್ನಡ — deep leaf 🌿', sequence: 5 },
  { id: 6, parent_id: null, title: 'Part two', sequence: 6 },
  { id: 7, parent_id: 6, title: 'Beginning', sequence: 7 },
]
