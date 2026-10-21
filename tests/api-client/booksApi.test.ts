import { configureStore } from '@reduxjs/toolkit'
import { afterEach, expect, it, vi } from 'vitest'
import { booksApi } from '../../src/api-client/resources/booksApi'
import { book } from './fixtures/book'

const makeStore = () =>
  configureStore({
    reducer: { [booksApi.reducerPath]: booksApi.reducer },
    middleware: (defaults) => defaults().concat(booksApi.middleware),
  })
let store = makeStore()
afterEach(() => {
  store.dispatch(booksApi.util.resetApiState())
  store = makeStore()
})

it('resolves file URLs before caching, preserving the generated book fields', async () => {
  const wireBook = {
    ...book,
    cover_url: '/api/v1/cover-files/17',
    source_pdf_url: '/api/v1/source-pdf-files/9',
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        items: [{ ...wireBook, future: true }],
        offset: 0,
        limit: 24,
        total: 1,
      }),
    ),
  )

  await store.dispatch(booksApi.endpoints.libraryBooks.initiate())

  expect(
    booksApi.endpoints.libraryBooks.select()(store.getState()).data?.pages[0]
      .items[0],
  ).toEqual({
    ...wireBook,
    cover_url: 'http://127.0.0.1:8000/api/v1/cover-files/17',
    source_pdf_url: 'http://127.0.0.1:8000/api/v1/source-pdf-files/9',
  })
})

it('rejects invalid raw data before attempting the response transformation', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        items: null,
        offset: 0,
        limit: 24,
        total: 1,
      }),
    ),
  )

  const result = await store.dispatch(
    booksApi.endpoints.libraryBooks.initiate(),
  )

  expect(result.error).toMatchObject({
    status: 'CUSTOM_ERROR',
    data: { code: 'response_contract_error' },
  })
  expect(
    booksApi.endpoints.libraryBooks.select()(store.getState()).data,
  ).toBeUndefined()
})

it('tags the library list and books across every loaded page', () => {
  store.dispatch(
    booksApi.util.upsertQueryEntries([
      {
        endpointName: 'libraryBooks',
        arg: undefined,
        value: {
          pages: [
            { items: [book], offset: 0, limit: 24, total: 2 },
            { items: [{ ...book, id: 2 }], offset: 1, limit: 24, total: 2 },
          ],
          pageParams: [0, 1],
        },
      },
    ]),
  )

  for (const id of ['LIST', 1, 2]) {
    expect(
      booksApi.util.selectInvalidatedBy(store.getState(), [
        { type: 'Book', id },
      ]),
    ).toEqual([expect.objectContaining({ endpointName: 'libraryBooks' })])
  }
})

it('validates named errors for the infinite endpoint', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { error: { code: 'internal_error', message: 'Failed', extra: true } },
        { status: 500 },
      ),
    ),
  )
  const result = await store.dispatch(
    booksApi.endpoints.libraryBooks.initiate(),
  )
  expect(result.error).toEqual({
    status: 500,
    data: { error: { code: 'internal_error', message: 'Failed' } },
  })
})

it('refreshes the library after a book update without refetching unrelated cache', async () => {
  let title = book.title
  const fetch = vi.fn(async (request: Request) => {
    if (request.method === 'PATCH') {
      title = 'Updated title'
      return Response.json({ ...book, title })
    }
    if (request.url.endsWith('/health'))
      return Response.json({ status: 'ok', api_version: 'v1' })
    return Response.json({
      items: [{ ...book, title }],
      offset: 0,
      limit: 24,
      total: 1,
    })
  })
  vi.stubGlobal('fetch', fetch)
  await store.dispatch(booksApi.endpoints.libraryBooks.initiate())
  await store.dispatch(booksApi.endpoints.getApiV1Health.initiate())
  expect(
    booksApi.endpoints.getApiV1Health.select()(store.getState()).data,
  ).toEqual({
    status: 'ok',
    api_version: 'v1',
  })
  await store.dispatch(
    booksApi.endpoints.patchApiV1Book.initiate({
      bookId: 1,
      bookPatch: { title: 'Updated title' },
    }),
  )
  await vi.waitFor(() =>
    expect(
      booksApi.endpoints.libraryBooks.select()(store.getState()).data?.pages[0]
        .items[0].title,
    ).toBe('Updated title'),
  )
  expect(
    fetch.mock.calls.filter(([request]) => request.url.endsWith('/health')),
  ).toHaveLength(1)
})
