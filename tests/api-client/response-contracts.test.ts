import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  BookCreate,
  BookList,
  BookPatch,
  BookResponse,
  BodyCreateApiV1CoverFile,
  BodyCreateApiV1SourcePdfFile,
  BookErrorResponse,
  ValidationErrorResponse,
  type BookResponseOutput,
  type BookListOutput,
} from '../../src/api-client/generated/schemas'
import type {
  GetApiV1BookApiResponse,
  ListApiV1BooksApiResponse,
  CreateApiV1CoverFileApiArg,
} from '../../src/api-client/generated/endpoints'
import { book } from './fixtures/book'

describe('generated contracts', () => {
  it('keeps RTK results and Zod output types consistent', () => {
    expectTypeOf<GetApiV1BookApiResponse>().toEqualTypeOf<BookResponseOutput>()
    expectTypeOf<ListApiV1BooksApiResponse>().toEqualTypeOf<BookListOutput>()
    expectTypeOf<
      CreateApiV1CoverFileApiArg['bodyCreateApiV1CoverFile']
    >().toEqualTypeOf<{ file: Blob }>()
  })

  it('parses Unicode books and paginated lists without date coercion', () => {
    expect(BookResponse.parse(book)).toEqual(book)
    expect(
      BookList.parse({ items: [book], limit: 50, offset: 0, total: 1 }),
    ).toEqual({ items: [book], limit: 50, offset: 0, total: 1 })
    expect(BookResponse.parse(book).created_at).toBe(book.created_at)
  })

  it('matches backend Unicode code-point length limits, including non-BMP text', () => {
    expect(
      BookResponse.safeParse({ ...book, title: '📚'.repeat(750) }).success,
    ).toBe(true)
    expect(
      BookResponse.safeParse({ ...book, title: '📚'.repeat(751) }).success,
    ).toBe(false)
    expect(
      BookCreate.safeParse({ title: '📚'.repeat(750), language: 'en' }).success,
    ).toBe(true)
    expect(BookPatch.safeParse({ author: '📚'.repeat(450) }).success).toBe(true)
    expect(BookPatch.safeParse({ author: '📚'.repeat(451) }).success).toBe(
      false,
    )
    expect(BookPatch.safeParse({ title: '' }).success).toBe(false)
  })

  it('accepts and strips unknown properties recursively', () => {
    expect(
      BookList.parse({
        items: [{ ...book, future_field: 'additive change' }],
        limit: 50,
        offset: 0,
        total: 1,
        future_total: 100,
      }),
    ).toEqual({ items: [book], limit: 50, offset: 0, total: 1 })
  })

  it.each([
    { ...book, id: '1' },
    { ...book, id: 1.5 },
    { ...book, id: Number.MAX_SAFE_INTEGER + 1 },
    { ...book, title: null },
    { ...book, cover_url: undefined },
    { ...book, author: undefined },
    { ...book, created_at: 'yesterday' },
    { ...book, updated_at: '2026-02-30T10:30:00Z' },
    { ...book, updated_at: '2026-10-21T10:30:00' },
  ])('rejects invalid or missing required response values (%#)', (value) => {
    expect(BookResponse.safeParse(value).success).toBe(false)
  })

  it('distinguishes omission, nullable fields, and non-nullable PATCH fields', () => {
    expect(BookPatch.parse({})).toEqual({})
    expect(BookPatch.parse({ author: null, cover_file_id: null })).toEqual({
      author: null,
      cover_file_id: null,
    })
    expect(BookPatch.safeParse({ title: null }).success).toBe(false)
    expect(BookPatch.safeParse({ language: null }).success).toBe(false)
    expect(BookCreate.parse({ title: 'Book', language: 'en' })).toEqual({
      title: 'Book',
      language: 'en',
    })
  })

  it('validates named domain and validation error envelopes', () => {
    expect(
      BookErrorResponse.parse({
        error: {
          code: 'book_not_found',
          message: 'Book not found',
          extra: true,
        },
      }),
    ).toEqual({ error: { code: 'book_not_found', message: 'Book not found' } })
    expect(
      BookErrorResponse.safeParse({ error: { code: 'invented', message: 'x' } })
        .success,
    ).toBe(false)
    expect(
      ValidationErrorResponse.parse({
        error: { code: 'validation_error', message: 'Invalid request' },
        issues: [
          {
            location: ['body', 'title', 0],
            code: 'missing',
            message: 'Required',
          },
        ],
      }).issues,
    ).toHaveLength(1)
  })

  it('validates multipart Blob/File fields without treating them as JSON strings', () => {
    const image = new File(['image'], 'cover.png', { type: 'image/png' })
    const pdf = new Blob(['%PDF-test'], { type: 'application/pdf' })
    expect(BodyCreateApiV1CoverFile.parse({ file: image })).toEqual({
      file: image,
    })
    expect(BodyCreateApiV1SourcePdfFile.parse({ file: pdf })).toEqual({
      file: pdf,
    })
    expect(
      BodyCreateApiV1CoverFile.safeParse({ file: 'cover.png' }).success,
    ).toBe(false)
    expect(BodyCreateApiV1SourcePdfFile.safeParse({}).success).toBe(false)
  })
})
