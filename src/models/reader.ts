import type { SegmentReadOutput } from '../api-client/generated/schemas'

export type ReaderSegment = Pick<
  SegmentReadOutput,
  'id' | 'source_key' | 'kind' | 'html_content' | 'text_content' | 'language'
>

export type ReaderSegmentError =
  | 'unsupported-kind'
  | 'unsupported-markup'
  | 'text-mismatch'
  | 'sanitizer-unavailable'
