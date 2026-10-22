import { configureStore } from '@reduxjs/toolkit'
import type { BaseQueryApi } from '@reduxjs/toolkit/query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { archiveApi } from '../../src/api-client/archiveApi'
import { createArchiveBaseQuery } from '../../src/api-client/client'
import { book } from './fixtures/book'

function testStore() {
  return configureStore({
    reducer: { [archiveApi.reducerPath]: archiveApi.reducer },
    middleware: (defaults) => defaults().concat(archiveApi.middleware),
  })
}

let store = testStore()
afterEach(() => {
  store.dispatch(archiveApi.util.resetApiState())
  store = testStore()
})

describe('generated RTK endpoint validation', () => {
  it('validates and strips JSON before it reaches RTK state', async () => {
    const fetchMock = vi.fn(async (_request: Request) =>
      Response.json({ ...book, future: true }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const result = await store.dispatch(
      archiveApi.endpoints.getApiV1Book.initiate({ bookId: 1 }),
    )
    expect(result.data).toEqual(book)
    expect(
      archiveApi.endpoints.getApiV1Book.select({ bookId: 1 })(store.getState())
        .data,
    ).toEqual(book)
    const request = fetchMock.mock.calls[0][0]
    expect(request.url).toBe('http://127.0.0.1:8000/api/v1/books/1')
  })

  it('returns a controlled error and never caches invalid response data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ...book, title: 42 })),
    )
    const result = await store.dispatch(
      archiveApi.endpoints.getApiV1Book.initiate({ bookId: 1 }),
    )
    expect(result.error).toMatchObject({
      status: 'CUSTOM_ERROR',
      data: { code: 'response_contract_error' },
    })
    expect(
      archiveApi.endpoints.getApiV1Book.select({ bookId: 1 })(store.getState())
        .data,
    ).toBeUndefined()
  })

  it('uses generated pagination arguments', async () => {
    const fetchMock = vi.fn(async (_request: Request) =>
      Response.json({
        items: [book],
        limit: 5,
        offset: 10,
        total: 11,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const result = await store.dispatch(
      archiveApi.endpoints.listApiV1Books.initiate({ limit: 5, offset: 10 }),
    )
    expect(result.data?.items).toEqual([book])
    const request = fetchMock.mock.calls[0][0]
    expect(new URL(request.url).searchParams.toString()).toBe(
      'limit=5&offset=10',
    )
  })

  it('validates documented errors and strips their extra properties', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: { code: 'book_not_found', message: 'Missing', extra: true },
            extra: true,
          },
          { status: 404 },
        ),
      ),
    )
    const result = await store.dispatch(
      archiveApi.endpoints.getApiV1Book.initiate({ bookId: 1 }),
    )
    expect(result.error).toEqual({
      status: 404,
      data: { error: { code: 'book_not_found', message: 'Missing' } },
    })
  })

  it('rejects malformed documented error envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ detail: 'Missing' }, { status: 404 })),
    )
    const result = await store.dispatch(
      archiveApi.endpoints.getApiV1Book.initiate({ bookId: 1 }),
    )
    expect(result.error).toMatchObject({ status: 'CUSTOM_ERROR' })
  })

  it('preserves network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline')
      }),
    )
    const result = await store.dispatch(
      archiveApi.endpoints.getApiV1Book.initiate({ bookId: 1 }),
    )
    expect(result.error).toMatchObject({ status: 'FETCH_ERROR' })
  })

  it.each([
    ['cover', 'image/png'],
    ['source_pdf', 'application/pdf'],
  ] as const)(
    'sends a real multipart %s upload and validates its JSON result',
    async (kind, type) => {
      const file = new File(['bytes'], kind, { type })
      const response = {
        id: 1,
        kind,
        byte_size: 5,
        metadata: {
          cover: { width: 10, height: 20 },
          source_pdf: { page_count: 1 },
        }[kind],
        created_at: book.created_at,
      }
      const fetchMock = vi.fn(async (request: Request) => {
        expect(request.headers.get('content-type')).toMatch(
          /^multipart\/form-data; boundary=/,
        )
        const form = await request.formData()
        const uploaded = form.get('file') as File
        expect(uploaded.name).toBe(kind)
        expect(uploaded.type).toBe(type)
        expect(await uploaded.text()).toBe('bytes')
        expect(Array.from(form.keys())).toEqual(['file'])
        return Response.json(response, { status: 201 })
      })
      vi.stubGlobal('fetch', fetchMock)
      const result = await store.dispatch(
        archiveApi.endpoints.createApiV1File.initiate({
          kind,
          bodyCreateApiV1File: { file },
        }),
      )
      expect(result.data).toEqual(response)
      expect(fetchMock).toHaveBeenCalledOnce()
    },
  )

  it('handles successful bodyless deletion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )
    const result = await store.dispatch(
      archiveApi.endpoints.deleteApiV1Book.initiate({ bookId: 1 }),
    )
    expect(result.error).toBeUndefined()
    expect(result.data).toBeNull()
  })

  it('keeps binary downloads and HEAD operations outside JSON endpoints', () => {
    expect(archiveApi.endpoints).not.toHaveProperty('getApiV1File')
    expect(archiveApi.endpoints).not.toHaveProperty('headApiV1File')
  })
})

describe('error schema selection', () => {
  it.each([
    ['arbitraryAlias', { errorSchemaEndpoint: 'getApiV1Book' }],
    ['getApiV1Book', undefined],
  ] as const)(
    'validates errors for %s using its override or endpoint name',
    async (endpoint, extraOptions) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json(
            {
              error: {
                code: 'book_not_found',
                message: 'Missing',
                extra: true,
              },
              extra: true,
            },
            { status: 404 },
          ),
        ),
      )

      const context: BaseQueryApi = {
        endpoint,
        type: 'query',
        signal: new AbortController().signal,
        abort: vi.fn(),
        dispatch: vi.fn(),
        getState: () => ({}),
        extra: undefined,
      }

      const query = createArchiveBaseQuery('http://127.0.0.1:8000')
      const result = await query('/api/v1/books/1', context, extraOptions ?? {})

      expect(result.error).toEqual({
        status: 404,
        data: { error: { code: 'book_not_found', message: 'Missing' } },
      })

      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json({ detail: 'Malformed error' }, { status: 404 }),
        ),
      )

      const invalidResult = await query(
        '/api/v1/books/1',
        context,
        extraOptions ?? {},
      )

      expect(invalidResult.error).toMatchObject({
        status: 'CUSTOM_ERROR',
        data: { code: 'response_contract_error' },
      })
    },
  )
})
