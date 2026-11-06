import type { FetchArgs } from '@reduxjs/toolkit/query'
import type { ListApiV1BooksApiArg } from '../generated/endpoints'
import { BookList, type BookListOutput } from '../generated/schemas'
import { archiveApi } from '../archiveApi'
import { apiBaseUrl } from '../baseApi'
import { saveLibraryPages } from '../../data/libraryRepository'

export const libraryPageSize = 24

// Reuse the generated request builder instead of duplicating URL/parameters.
// enhanceEndpoints runs synchronously before the infinite endpoint is injected.
let listBooksRequest!: (args: ListApiV1BooksApiArg) => string | FetchArgs

const taggedBooksApi = archiveApi.enhanceEndpoints({
  addTagTypes: ['Book'],
  endpoints: {
    listApiV1Books(definition) {
      listBooksRequest = definition.query!
    },

    createApiV1Book: {
      invalidatesTags: (_result, error) =>
        error ? [] : [{ type: 'Book', id: 'LIST' }],
    },

    patchApiV1Book: {
      invalidatesTags: (_result, error, { bookId }) =>
        error
          ? []
          : [
              { type: 'Book', id: bookId },
              { type: 'Book', id: 'LIST' },
            ],
    },

    deleteApiV1Book: {
      invalidatesTags: (_result, error, { bookId }) =>
        error
          ? []
          : [
              { type: 'Book', id: bookId },
              { type: 'Book', id: 'LIST' },
            ],
    },
  },
})

export const booksApi = taggedBooksApi.injectEndpoints({
  endpoints: (build) => ({
    libraryBooks: build.infiniteQuery<
      BookListOutput,
      void,
      number,
      BookListOutput
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,

        getNextPageParam: (lastPage) => {
          const next = lastPage.offset + lastPage.items.length

          return lastPage.items.length > 0 && next < lastPage.total
            ? next
            : undefined
        },
      },

      query: ({ pageParam }) =>
        listBooksRequest({ limit: libraryPageSize, offset: pageParam }),

      rawResponseSchema: BookList,

      transformResponse: (response) => ({
        ...response,
        items: response.items.map((book) => ({
          ...book,
          cover_url: book.cover_url
            ? new URL(book.cover_url, apiBaseUrl).href
            : null,
          source_pdf_url: book.source_pdf_url
            ? new URL(book.source_pdf_url, apiBaseUrl).href
            : null,
        })),
      }),

      extraOptions: { errorSchemaEndpoint: 'listApiV1Books' },

      async onQueryStarted(_arg, { queryFulfilled, getCacheEntry, requestId }) {
        let result
        try {
          result = await queryFulfilled
        } catch {
          return // Failed refreshes leave the saved catalog intact.
        }
        if (getCacheEntry().requestId !== requestId) return
        try {
          await saveLibraryPages(result.data.pages)
        } catch {
          console.warn('The library could not be saved for offline use.')
        }
      },

      providesTags: (result) => [
        { type: 'Book', id: 'LIST' },
        ...(result?.pages.flatMap((page) =>
          page.items.map(({ id }) => ({ type: 'Book' as const, id })),
        ) ?? []),
      ],
    }),
  }),
})
