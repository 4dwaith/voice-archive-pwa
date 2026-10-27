import type {
  SectionReadOutput,
  SegmentReadOutput,
} from '../api-client/generated/schemas'

export type ReaderSection = Pick<
  SectionReadOutput,
  'id' | 'parent_id' | 'title' | 'sequence'
>

export type ReaderTocPresentation = 'shown' | 'dimmed' | 'collapsed'

export type ReaderPageNavigation = { scope: 'local' | 'global' } & (
  { kind: 'absolute'; pageNumber: number } | { kind: 'relative'; delta: number }
)

export type ReaderSegment = Pick<
  SegmentReadOutput,
  'id' | 'source_key' | 'kind' | 'html_content' | 'text_content' | 'language'
>

export type ReaderSegmentError =
  | 'unsupported-kind'
  | 'unsupported-markup'
  | 'text-mismatch'
  | 'sanitizer-unavailable'
