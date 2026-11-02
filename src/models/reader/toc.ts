import type { SectionReadOutput } from '../../api-client/generated/schemas'

// Give the ToC display fields and a reason when a destination is unavailable.
export type ReaderSection = Pick<
  SectionReadOutput,
  'id' | 'parent_id' | 'title' | 'sequence'
> & { unavailableReason?: string }

// Share the ToC's shown, dimmed or collapsed presentation choice across controls.
export type ReaderTocPresentation = 'shown' | 'dimmed' | 'collapsed'
