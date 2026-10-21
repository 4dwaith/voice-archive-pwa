import type { BookResponseOutput } from '../../../src/api-client/generated/schemas'

// Representative backend wire data. Dates stay strings, including microseconds.
export const book = {
  id: 1,
  title: 'ರುದ್ರ ಚಮಕ',
  language: 'kn',
  author: null,
  description: 'ಕನ್ನಡ ಪಠ್ಯ',
  cover_file_id: null,
  source_pdf_file_id: null,
  cover_url: null,
  source_pdf_url: null,
  created_at: '2026-10-21T10:30:00.123456Z',
  updated_at: '2026-10-21T16:00:00.123456+05:30',
} satisfies BookResponseOutput
