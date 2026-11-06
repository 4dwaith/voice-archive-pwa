import {
  BookResponse,
  type BookResponseOutput,
} from '../api-client/generated/schemas'

// Storybook-only fixture factory. All fields retain the generated wire model.
export function makeBookFixture(overrides: Partial<BookResponseOutput> = {}) {
  return BookResponse.parse({
    id: 1,
    title: 'A Book',
    language: 'en',
    author: null,
    description: null,
    cover_file_id: null,
    source_pdf_file_id: null,
    series_id: null,
    series_index: null,
    series_title: null,
    cover_url: null,
    source_pdf_url: null,
    created_at: '2026-10-21T00:00:00Z',
    updated_at: '2026-10-21T00:00:00Z',
    ...overrides,
  })
}

const sampleBooks = [
  ['Pride and Prejudice', '/covers/pride-and-prejudice.jpg'],
  ['The Wind in the Willows', '/covers/wind-in-the-willows.jpg'],
  ['Little Women', '/covers/little-women.jpg'],
  ['Treasure Island', '/covers/treasure-island.jpg'],
  ['Frankenstein', '/covers/frankenstein.jpg'],
  ['The Adventures of Sherlock Holmes', '/covers/sherlock-holmes.jpg'],
] as const

export const books = sampleBooks.map(([title, cover_url], index) =>
  makeBookFixture({
    id: index + 1,
    title,
    cover_file_id: index + 1,
    cover_url,
  }),
)

const extraTitles = [
  ['ಗೀತಾಭಾವಧಾರೆ', 'kn'],
  ['ರುದ್ರ ಚಮಕ', 'kn'],
  ['日本語の本', 'ja'],
  ['كتاب الحكمة', 'ar'],
  ['Les Misérables', 'fr'],
  ['Don Quixote', 'es'],
  ['The Secret Garden', 'en'],
  ['Alice in Wonderland', 'en'],
  ['A Tale of Two Cities', 'en'],
  ['Jane Eyre', 'en'],
  ['Wuthering Heights', 'en'],
  ['Moby Dick', 'en'],
  ['The Odyssey', 'en'],
  ['The Iliad', 'en'],
  ['The Jungle Book', 'en'],
  ['Black Beauty', 'en'],
  ['Anne of Green Gables', 'en'],
  ['The Railway Children', 'en'],
  ['The Wonderful Wizard of Oz', 'en'],
  ['The Time Machine', 'en'],
  ['A Journey to the Centre of the Earth', 'en'],
  ['The Call of the Wild', 'en'],
  ['Walden', 'en'],
  [
    'A Book of Very Long Words Including Pneumonoultramicroscopicsilicovolcanoconiosis',
    'en',
  ],
] as const

export const scrollingBooks = [
  ...books,
  ...extraTitles.map(([title, language], index) =>
    makeBookFixture({
      id: index + books.length + 1,
      title,
      language,
    }),
  ),
]
