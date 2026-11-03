import Dexie from 'dexie'
import { database } from './database'
import type { CachedSegment } from '../models/content'
import type { ReaderScope } from '../models/reader'
import type { NarrationCue } from '../models/readerAudio'
import { findRootSectionAudio } from '../utils/contentHierarchy'
import { apiBaseUrl } from '../api-client/baseApi'
import { getContentSections } from './contentRepository'

export function hasNarration(segment: CachedSegment) {
  return (
    segment.narration_start_ms !== null && segment.narration_end_ms !== null
  )
}

export type NarrationTarget = {
  segment: NarrationCue
  fileId: number
  url: string
}

function createNarrationCue(segment: CachedSegment): NarrationCue {
  return {
    id: segment.id,
    sequence: segment.sequence,
    section_id: segment.section_id,
    root_section_id: segment.root_section_id,
    narration_start_ms: segment.narration_start_ms,
    narration_end_ms: segment.narration_end_ms,
    narration_seek_ms: segment.narration_seek_ms,
  }
}

// Undefined means the content stream has not yet reached the requested target.
export async function readNarrationTarget(
  scope: ReaderScope,
  request: { segmentId?: number; afterSequence?: number; skipRootId?: number },
  signal?: AbortSignal,
): Promise<NarrationTarget | null | undefined> {
  signal?.throwIfAborted()
  const target = await database.transaction(
    'r',
    database.content,
    database.sections,
    database.segments,
    async () => {
      const content = await database.content.get(scope.bookId)
      if (content?.version !== scope.contentVersion)
        throw new Error('This book content is no longer available.')
      let sequence = request.afterSequence ?? -1
      if (request.segmentId !== undefined) {
        const selected = await database.segments
          .where('[bookId+version+id]')
          .equals([scope.bookId, scope.contentVersion, request.segmentId])
          .first()
        if (!selected) return content.complete ? null : undefined
        sequence = selected.sequence
      }
      const segment = await database.segments
        .where('[bookId+version+sequence]')
        .between(
          [scope.bookId, scope.contentVersion, sequence],
          [scope.bookId, scope.contentVersion, Dexie.maxKey],
          request.segmentId !== undefined,
          true,
        )
        .filter(
          (segment) =>
            hasNarration(segment) &&
            segment.root_section_id !== request.skipRootId,
        )
        .first()
      if (!segment) return content.complete ? null : undefined
      const sections = await getContentSections(scope.bookId)
      const file = findRootSectionAudio(segment, sections, content)
      if (!file)
        throw new Error('The narrated segment has no root-section audio file.')
      return {
        segment: createNarrationCue(segment),
        fileId: file.id,
        url: new URL(file.url, apiBaseUrl).href,
      }
    },
  )
  signal?.throwIfAborted()
  return target
}

export async function readFileNarration(
  scope: ReaderScope,
  rootId: number,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted()
  const cues: NarrationCue[] = []
  // IndexedDB yields complete records; retain only lightweight cues for this root.
  await database.segments
    .where('[bookId+version+root_section_id+sequence]')
    .between(
      [scope.bookId, scope.contentVersion, rootId, Dexie.minKey],
      [scope.bookId, scope.contentVersion, rootId, Dexie.maxKey],
    )
    .each((segment) => {
      if (hasNarration(segment)) cues.push(createNarrationCue(segment))
    })
  signal?.throwIfAborted()
  return cues
}
