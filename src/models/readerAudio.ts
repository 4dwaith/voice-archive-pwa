import type { CachedSegment } from './content'

export type NarrationCue = Pick<
  CachedSegment,
  | 'id'
  | 'sequence'
  | 'section_id'
  | 'root_section_id'
  | 'narration_start_ms'
  | 'narration_end_ms'
  | 'narration_seek_ms'
>

export type ReaderAudioSnapshot = Readonly<{
  segment: NarrationCue | null
  speakingSegmentId: number | null
  isPlaying: boolean
  status:
    | 'idle'
    | 'preparing'
    | 'paused'
    | 'playing'
    | 'buffering'
    | 'ended'
    | 'error'
  error: string | null
}>
