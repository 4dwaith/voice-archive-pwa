import type { BookListOutput } from '../api-client/generated/schemas'
import { database } from './database'

export async function saveLibraryPages(pages: BookListOutput[]) {
  if (!pages.length) return

  const total = pages[0].total
  const books = [
    ...new Map(
      pages.flatMap((page) =>
        page.items.map((book) => [book.id, book] as const),
      ),
    ).values(),
  ]
  let nextOffset = 0
  const complete =
    pages.every((page) => {
      if (page.offset !== nextOffset || page.total !== total) return false
      nextOffset += page.items.length
      return true
    }) &&
    nextOffset === total &&
    books.length === total

  await database.transaction(
    'rw',
    database.books,
    database.libraryCatalog,
    async () => {
      // Only a complete traversal proves that an absent book was removed.
      if (complete) await database.books.clear()
      await database.books.bulkPut(books)
      await database.libraryCatalog.put({ id: 'catalog', total, complete })
    },
  )
}

export async function readSavedLibrary() {
  return database.transaction(
    'r',
    database.books,
    database.libraryCatalog,
    async () => ({
      books: await database.books.orderBy('id').toArray(),
      catalog: await database.libraryCatalog.get('catalog'),
    }),
  )
}
