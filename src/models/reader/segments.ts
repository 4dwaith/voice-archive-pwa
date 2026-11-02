import type { SegmentReadOutput } from '../../api-client/generated/schemas'

// Supply the text and markup needed to render and measure a segment.
export type ReaderSegment = Pick<
  SegmentReadOutput,
  'id' | 'source_key' | 'kind' | 'html_content' | 'text_content' | 'language'
>

// Explain why a segment cannot be rendered or measured safely.
export type ReaderSegmentError =
  | 'unsupported-kind'
  | 'unsupported-markup'
  | 'text-mismatch'
  | 'sanitizer-unavailable'
