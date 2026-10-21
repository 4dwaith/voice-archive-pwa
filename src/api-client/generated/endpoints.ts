// GENERATED FILE. Run npm run api:regenerate; do not edit.
import { baseApi as api } from '../baseApi'
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    createApiV1Book: build.mutation<
      CreateApiV1BookApiResponse,
      CreateApiV1BookApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/books`,
        method: 'POST',
        body: queryArg.bookCreate,
      }),
    }),
    listApiV1Books: build.query<
      ListApiV1BooksApiResponse,
      ListApiV1BooksApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/books`,
        params: {
          limit: queryArg.limit,
          offset: queryArg.offset,
        },
      }),
    }),
    getApiV1Book: build.query<GetApiV1BookApiResponse, GetApiV1BookApiArg>({
      query: (queryArg) => ({ url: `/api/v1/books/${queryArg.bookId}` }),
    }),
    patchApiV1Book: build.mutation<
      PatchApiV1BookApiResponse,
      PatchApiV1BookApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/books/${queryArg.bookId}`,
        method: 'PATCH',
        body: queryArg.bookPatch,
      }),
    }),
    deleteApiV1Book: build.mutation<
      DeleteApiV1BookApiResponse,
      DeleteApiV1BookApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/books/${queryArg.bookId}`,
        method: 'DELETE',
      }),
    }),
    createApiV1CoverFile: build.mutation<
      CreateApiV1CoverFileApiResponse,
      CreateApiV1CoverFileApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/cover-files`,
        method: 'POST',
        body: queryArg.bodyCreateApiV1CoverFile,
      }),
    }),
    deleteApiV1CoverFile: build.mutation<
      DeleteApiV1CoverFileApiResponse,
      DeleteApiV1CoverFileApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/cover-files/${queryArg.fileId}`,
        method: 'DELETE',
      }),
    }),
    createApiV1SourcePdfFile: build.mutation<
      CreateApiV1SourcePdfFileApiResponse,
      CreateApiV1SourcePdfFileApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/source-pdf-files`,
        method: 'POST',
        body: queryArg.bodyCreateApiV1SourcePdfFile,
      }),
    }),
    deleteApiV1SourcePdfFile: build.mutation<
      DeleteApiV1SourcePdfFileApiResponse,
      DeleteApiV1SourcePdfFileApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/source-pdf-files/${queryArg.fileId}`,
        method: 'DELETE',
      }),
    }),
    getApiV1Health: build.query<
      GetApiV1HealthApiResponse,
      GetApiV1HealthApiArg
    >({
      query: () => ({ url: `/api/v1/health` }),
    }),
    getApiV1Ready: build.query<GetApiV1ReadyApiResponse, GetApiV1ReadyApiArg>({
      query: () => ({ url: `/api/v1/ready` }),
    }),
  }),
  overrideExisting: false,
})
export { injectedRtkApi as generatedApi }
export type CreateApiV1BookApiResponse =
  /** status 201 Successful Response */ BookResponse
export type CreateApiV1BookApiArg = {
  bookCreate: BookCreate
}
export type ListApiV1BooksApiResponse =
  /** status 200 Successful Response */ BookList
export type ListApiV1BooksApiArg = {
  limit?: number
  offset?: number
}
export type GetApiV1BookApiResponse =
  /** status 200 Successful Response */ BookResponse
export type GetApiV1BookApiArg = {
  bookId: number
}
export type PatchApiV1BookApiResponse =
  /** status 200 Successful Response */ BookResponse
export type PatchApiV1BookApiArg = {
  bookId: number
  bookPatch: BookPatch
}
export type DeleteApiV1BookApiResponse = unknown
export type DeleteApiV1BookApiArg = {
  bookId: number
}
export type CreateApiV1CoverFileApiResponse =
  /** status 201 Successful Response */ CoverFileResponse
export type CreateApiV1CoverFileApiArg = {
  bodyCreateApiV1CoverFile: BodyCreateApiV1CoverFile
}
export type DeleteApiV1CoverFileApiResponse = unknown
export type DeleteApiV1CoverFileApiArg = {
  fileId: number
}
export type CreateApiV1SourcePdfFileApiResponse =
  /** status 201 Successful Response */ SourcePdfFileResponse
export type CreateApiV1SourcePdfFileApiArg = {
  bodyCreateApiV1SourcePdfFile: BodyCreateApiV1SourcePdfFile
}
export type DeleteApiV1SourcePdfFileApiResponse = unknown
export type DeleteApiV1SourcePdfFileApiArg = {
  fileId: number
}
export type GetApiV1HealthApiResponse =
  /** status 200 Successful Response */ HealthResponse
export type GetApiV1HealthApiArg = void
export type GetApiV1ReadyApiResponse =
  /** status 200 Successful Response */ HealthResponse
export type GetApiV1ReadyApiArg = void
export type BookResponse = {
  id: number
  title: string
  /** Required language code validated by langcodes (for example en or kn) */
  language: string
  author: string | null
  description: string | null
  cover_file_id: number | null
  source_pdf_file_id: number | null
  created_at: string
  updated_at: string
  /** API delivery URL for the linked cover, relative to this origin */
  cover_url: string | null
  /** API delivery URL for the linked source PDF, relative to this origin */
  source_pdf_url: string | null
}
export type CoverFileErrorCode =
  | 'cover_file_not_found'
  | 'cover_file_already_linked'
  | 'invalid_image'
  | 'unsupported_media_type'
export type ErrorDetailCoverFileErrorCode = {
  code: CoverFileErrorCode
  message: string
}
export type CoverFileErrorResponse = {
  error: ErrorDetailCoverFileErrorCode
}
export type SourcePdfFileErrorCode =
  | 'source_pdf_file_not_found'
  | 'source_pdf_file_already_linked'
  | 'invalid_pdf'
  | 'encrypted_pdf_not_supported'
export type ErrorDetailSourcePdfFileErrorCode = {
  code: SourcePdfFileErrorCode
  message: string
}
export type SourcePdfFileErrorResponse = {
  error: ErrorDetailSourcePdfFileErrorCode
}
export type ErrorDetailLiteralRouteNotFoundMethodNotAllowedHttpError = {
  code: 'route_not_found' | 'method_not_allowed' | 'http_error'
  message: string
}
export type HttpErrorResponse = {
  error: ErrorDetailLiteralRouteNotFoundMethodNotAllowedHttpError
}
export type BookErrorCode =
  | 'book_not_found'
  | 'duplicate_book'
  | 'cover_file_already_linked'
  | 'source_pdf_file_already_linked'
export type ErrorDetailBookErrorCode = {
  code: BookErrorCode
  message: string
}
export type BookErrorResponse = {
  error: ErrorDetailBookErrorCode
}
export type ErrorDetailLiteralValidationError = {
  code: 'validation_error'
  message: string
}
export type ValidationIssue = {
  location: (string | number)[]
  code: string
  message: string
}
export type ValidationErrorResponse = {
  error: ErrorDetailLiteralValidationError
  issues: ValidationIssue[]
}
export type ErrorDetailLiteralInternalError = {
  code: 'internal_error'
  message: string
}
export type InternalErrorResponse = {
  error: ErrorDetailLiteralInternalError
}
export type BookCreate = {
  title: string
  /** Required language code validated by langcodes (for example en or kn) */
  language: string
  author?: string | null
  description?: string | null
  cover_file_id?: number | null
  source_pdf_file_id?: number | null
}
export type BookList = {
  items: BookResponse[]
  limit: number
  offset: number
  total: number
}
export type BookPatch = {
  title?: string
  /** Required language code validated by langcodes (for example en or kn) */
  language?: string
  author?: string | null
  description?: string | null
  cover_file_id?: number | null
  source_pdf_file_id?: number | null
}
export type CoverFileResponse = {
  id: number
  byte_size: number
  width: number
  height: number
  created_at: string
}
export type ErrorDetailLiteralFileTooLargeInvalidMultipart = {
  code: 'file_too_large' | 'invalid_multipart'
  message: string
}
export type FileUploadErrorResponse = {
  error: ErrorDetailLiteralFileTooLargeInvalidMultipart
}
export type BodyCreateApiV1CoverFile = {
  /** JPEG, PNG, or WebP; normalized to a static WebP cover */
  file: Blob
}
export type SourcePdfFileResponse = {
  id: number
  byte_size: number
  page_count: number
  created_at: string
}
export type BodyCreateApiV1SourcePdfFile = {
  /** Unencrypted PDF with at least one page; original bytes are preserved */
  file: Blob
}
export type HealthResponse = {
  status: 'ok'
  api_version: 'v1'
}
export type NotReadyResponse = {
  status: 'unavailable'
  api_version: 'v1'
}
export const {
  useCreateApiV1BookMutation,
  useListApiV1BooksQuery,
  useGetApiV1BookQuery,
  usePatchApiV1BookMutation,
  useDeleteApiV1BookMutation,
  useCreateApiV1CoverFileMutation,
  useDeleteApiV1CoverFileMutation,
  useCreateApiV1SourcePdfFileMutation,
  useDeleteApiV1SourcePdfFileMutation,
  useGetApiV1HealthQuery,
  useGetApiV1ReadyQuery,
} = injectedRtkApi
