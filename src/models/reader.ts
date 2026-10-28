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

export type ReaderMeasurementTarget = { chapterId: string; layoutKey: string }

type ReaderTextPosition = {
  segmentId: number
  sourceKey: string
  offset: number
}

export type ReaderLayoutMeasurement = {
  layoutKey: string
  width: number
  height: number
  textSizePercent: number
  pages: {
    localPage: number
    start: ReaderTextPosition | null
    end: ReaderTextPosition | null
  }[]
  unmappableSegmentIds: number[]
}

export type ReaderPageMeasurement = ReaderMeasurementTarget &
  ReaderLayoutMeasurement
