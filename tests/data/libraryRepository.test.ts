import '../helpers/database'
import { describe, expect, it } from 'vitest'
import { database } from '../../src/data/database'
import {
  readSavedLibrary,
  saveLibraryPages,
} from '../../src/data/libraryRepository'
import { book } from '../api-client/fixtures/book'

describe('Saved library', () => {
  it('retains older books during a partial refresh', async () => {
    await database.books.bulkPut([book, { ...book, id: 2 }])

    await saveLibraryPages([
      { items: [{ ...book, title: 'Updated' }], offset: 0, limit: 1, total: 3 },
    ])
    const saved = await readSavedLibrary()

    expect(saved.books.map(({ id, title }) => [id, title])).toEqual([
      [book.id, 'Updated'],
      [2, book.title],
    ])
    expect(saved.catalog).toMatchObject({ total: 3, complete: false })
  })

  it('prunes removed books after a complete traversal', async () => {
    await database.books.put({ ...book, id: 99 })

    await saveLibraryPages([
      { items: [book], offset: 0, limit: 1, total: 2 },
      { items: [{ ...book, id: 2 }], offset: 1, limit: 1, total: 2 },
    ])
    const saved = await readSavedLibrary()

    expect(saved.books.map(({ id }) => id)).toEqual([book.id, 2])
    expect(saved.catalog).toMatchObject({ total: 2, complete: true })
  })

  it('accepts an empty complete catalog', async () => {
    await database.books.put(book)

    await saveLibraryPages([{ items: [], offset: 0, limit: 24, total: 0 }])
    const saved = await readSavedLibrary()

    expect(saved.books).toEqual([])
    expect(saved.catalog).toMatchObject({ total: 0, complete: true })
  })

  it.each([
    [{ items: [book], offset: 1, limit: 1, total: 1 }],
    [
      { items: [book], offset: 0, limit: 1, total: 2 },
      { items: [book], offset: 1, limit: 1, total: 2 },
    ],
    [
      { items: [book], offset: 0, limit: 1, total: 2 },
      { items: [{ ...book, id: 2 }], offset: 1, limit: 1, total: 3 },
    ],
  ])('keeps uncertain traversals partial: %j', async (...pages) => {
    await database.books.put({ ...book, id: 99 })

    await saveLibraryPages(pages)
    const saved = await readSavedLibrary()

    expect(saved.catalog?.complete).toBe(false)
    expect(saved.books.some(({ id }) => id === 99)).toBe(true)
  })
})
