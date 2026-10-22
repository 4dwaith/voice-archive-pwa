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
    importApiV1BookContent: build.mutation<
      ImportApiV1BookContentApiResponse,
      ImportApiV1BookContentApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/books/${queryArg.bookId}/content-imports`,
        method: 'POST',
        body: queryArg.contentInput,
        params: {
          dry_run: queryArg.dryRun,
        },
      }),
    }),
    getApiV1BookContent: build.query<
      GetApiV1BookContentApiResponse,
      GetApiV1BookContentApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/books/${queryArg.bookId}/content`,
      }),
    }),
    purgeApiV1BookContent: build.mutation<
      PurgeApiV1BookContentApiResponse,
      PurgeApiV1BookContentApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/books/${queryArg.bookId}/content`,
        method: 'DELETE',
        headers: {
          'if-match': queryArg['if-match'],
        },
      }),
    }),
    createApiV1File: build.mutation<
      CreateApiV1FileApiResponse,
      CreateApiV1FileApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/files/${queryArg.kind}`,
        method: 'POST',
        body: queryArg.bodyCreateApiV1File,
      }),
    }),
    deleteApiV1File: build.mutation<
      DeleteApiV1FileApiResponse,
      DeleteApiV1FileApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/files/${queryArg.fileId}`,
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
export type ImportApiV1BookContentApiResponse =
  /** status 200 Successful Response */ ImportResult
export type ImportApiV1BookContentApiArg = {
  bookId: number
  dryRun?: boolean
  contentInput: ContentInput
}
export type GetApiV1BookContentApiResponse =
  /** status 200 Successful Response */ ContentManifest
export type GetApiV1BookContentApiArg = {
  bookId: number
}
export type PurgeApiV1BookContentApiResponse = unknown
export type PurgeApiV1BookContentApiArg = {
  bookId: number
  'if-match'?: string
}
export type CreateApiV1FileApiResponse =
  /** status 201 Successful Response */ FileResponse
export type CreateApiV1FileApiArg = {
  kind: FileKind
  bodyCreateApiV1File: BodyCreateApiV1File
}
export type DeleteApiV1FileApiResponse = unknown
export type DeleteApiV1FileApiArg = {
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
export type FileErrorCode =
  | 'file_not_found'
  | 'file_already_linked'
  | 'file_kind_mismatch'
  | 'invalid_image'
  | 'unsupported_media_type'
  | 'invalid_pdf'
  | 'encrypted_pdf_not_supported'
  | 'invalid_audio'
export type ErrorDetailFileErrorCode = {
  code: FileErrorCode
  message: string
}
export type FileErrorResponse = {
  error: ErrorDetailFileErrorCode
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
  | 'file_already_linked'
  | 'content_purge_required'
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
export type ImportResult = {
  dry_run: boolean
  section_count: number
  segment_count: number
  content_version: string | null
}
export type ErrorDetailLiteralContentExistsContentPreconditionRequiredContentPreconditionFailedContentPayloadTooLarge =
  {
    code:
      | 'content_exists'
      | 'content_precondition_required'
      | 'content_precondition_failed'
      | 'content_payload_too_large'
    message: string
  }
export type ContentErrorResponse = {
  error: ErrorDetailLiteralContentExistsContentPreconditionRequiredContentPreconditionFailedContentPayloadTooLarge
}
export type ErrorDetailLiteralContentValidationError = {
  code: 'content_validation_error'
  message: string
}
export type ContentIssueResponse = {
  code: string
  path: string
  source_key: string | null
  detail: string
}
export type ContentValidationResponse = {
  error: ErrorDetailLiteralContentValidationError
  issues: ContentIssueResponse[]
}
export type SectionKind = 'part' | 'chapter' | 'section'
export type SectionInput = {
  source_key: string
  parent_source_key?: string | null
  kind: SectionKind
  title: string
  sibling_sequence: number
  audio_file_id?: number | null
}
export type SegmentKind = 'heading' | 'prose' | 'verse'
export type Region = {
  page_index: number
  x0: number
  y0: number
  x1: number
  y1: number
}
export type JsonValue = unknown
export type SegmentInput = {
  source_key: string
  section_source_key?: string | null
  sequence: number
  kind: SegmentKind
  html_content: string
  language?: string | null
  regions?: Region[]
  narration_start_ms?: number | null
  narration_end_ms?: number | null
  narration_seek_ms?: number | null
  alignment_status?: string | null
  alignment_metadata?: {
    [key: string]: JsonValue
  } | null
}
export type ContentInput = {
  schema_version: 1
  source_pdf_file_id?: number | null
  sections: SectionInput[]
  segments: SegmentInput[]
}
export type ContentManifest = {
  state: 'empty' | 'pdf_only' | 'published'
  content_version: string | null
  schema_version: number | null
  imported_at: string | null
  source_pdf_file_id: number | null
}
export type ValidationError = {
  loc: (string | number)[]
  msg: string
  type: string
  input?: unknown
  ctx?: object
}
export type HttpValidationError = {
  detail?: ValidationError[]
}
export type AudioMetadata = {
  duration_ms: number
  sample_rate: number
  channels: number
  [key: string]: unknown
}
export type AudioFileResponse = {
  id: number
  byte_size: number
  created_at: string
  kind: 'audio_chapter'
  metadata: AudioMetadata
}
export type CoverMetadata = {
  width: number
  height: number
  [key: string]: unknown
}
export type CoverFileResponse = {
  id: number
  byte_size: number
  created_at: string
  kind: 'cover'
  metadata: CoverMetadata
}
export type SourcePdfMetadata = {
  page_count: number
  [key: string]: unknown
}
export type SourcePdfFileResponse = {
  id: number
  byte_size: number
  created_at: string
  kind: 'source_pdf'
  metadata: SourcePdfMetadata
}
export type FileResponse =
  | ({
      kind: 'audio_chapter'
    } & AudioFileResponse)
  | ({
      kind: 'cover'
    } & CoverFileResponse)
  | ({
      kind: 'source_pdf'
    } & SourcePdfFileResponse)
export type ErrorDetailLiteralFileTooLargeInvalidMultipart = {
  code: 'file_too_large' | 'invalid_multipart'
  message: string
}
export type FileUploadErrorResponse = {
  error: ErrorDetailLiteralFileTooLargeInvalidMultipart
}
export type FileKind = 'cover' | 'source_pdf' | 'audio_chapter'
export type BodyCreateApiV1File = {
  /** File bytes, validated and prepared according to kind */
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
  useImportApiV1BookContentMutation,
  useGetApiV1BookContentQuery,
  usePurgeApiV1BookContentMutation,
  useCreateApiV1FileMutation,
  useDeleteApiV1FileMutation,
  useGetApiV1HealthQuery,
  useGetApiV1ReadyQuery,
} = injectedRtkApi
