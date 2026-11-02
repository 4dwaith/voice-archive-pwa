import type { CachedSection } from '../models/content'
import type { ReaderChapterRange, ReaderSection } from '../models/reader'

export function locateChapter(
  sequence: number,
  chapterIds: readonly string[],
  ranges: ReadonlyMap<string, ReaderChapterRange>,
): string | undefined {
  return chapterIds.find((id) => {
    const range = ranges.get(id)

    // Chapter ranges include their start and exclude their end.
    return (
      range &&
      sequence >= range.startSegmentSequenceNumber &&
      sequence < range.endSegmentSequenceNumber
    )
  })
}

export function deriveGlobalPage(
  currentPage: number | null,
  chapterId: string | undefined,
  chapterInfo:
    | {
        indexedChapterIds: readonly string[]
        countsByChapter: ReadonlyMap<string, number>
      }
    | null
    | undefined,
): number | null {
  const prefixIndex = chapterId
    ? (chapterInfo?.indexedChapterIds.indexOf(chapterId) ?? -1)
    : -1

  // Book numbering is known only within the contiguous indexed chapter prefix.
  return currentPage !== null && chapterInfo && prefixIndex >= 0
    ? currentPage +
        chapterInfo.indexedChapterIds
          .slice(0, prefixIndex)
          .reduce((sum, id) => sum + chapterInfo.countsByChapter.get(id)!, 0)
    : null
}

export function deriveTocSections(
  chapterInfo:
    | {
        sections: readonly CachedSection[]
        readyChapterIds: ReadonlySet<string>
        countsByChapter: ReadonlyMap<string, number>
        downloadedChapterRanges: ReadonlyMap<string, ReaderChapterRange>
      }
    | null
    | undefined,
): ReaderSection[] {
  function getUnavailableReason(chapterId: string, hasTarget = true) {
    if (!hasTarget) return 'No text target'
    if (!chapterInfo?.readyChapterIds.has(chapterId)) return 'Preparing pages'
    if (chapterInfo.countsByChapter.get(chapterId) === 0)
      return 'No readable pages'
    return undefined
  }

  const sections = chapterInfo?.sections ?? []
  const sectionsById = new Map(sections.map((section) => [section.id, section]))

  // Nested entries share their root chapter's page readiness.
  const tocSections: ReaderSection[] = sections.map((section) => {
    let root = section

    while (root.parent_id !== null) {
      const parent = sectionsById.get(root.parent_id)
      if (!parent) break
      root = parent
    }

    return {
      ...section,
      unavailableReason: getUnavailableReason(
        String(root.id),
        section.first_segment_source_key !== null,
      ),
    }
  })

  // Leading text before the first section gets its own synthetic ToC entry.
  const before = chapterInfo?.downloadedChapterRanges.get('before')
  if (
    before &&
    before.endSegmentSequenceNumber > before.startSegmentSequenceNumber
  )
    tocSections.unshift({
      id: 0,
      parent_id: null,
      title: 'Before',
      sequence: -1,
      unavailableReason: getUnavailableReason('before'),
    })

  return tocSections
}
