import Dexie from 'dexie'
import { database } from './database'
import type { ReaderScope } from '../models/reader'

type TextMatch = {
  offset: number
  before: string
  match: string
  after: string
}
export type TextSearchResult = TextMatch & {
  segmentId: number
  chapterId: string
  chapterTitle: string
}

export function isSearchQueryValid(query: string) {
  return query.trim().length > 0
}

// String indexes are UTF-16; anchors count canonical Unicode code points.
export function* findTextMatches(
  text: string,
  query: string,
): Generator<TextMatch> {
  if (!isSearchQueryValid(query)) return

  let start = text.indexOf(query)
  while (start !== -1) {
    const end = start + query.length
    const preceding = text.slice(0, start)
    const following = text.slice(end)
    const words = [...preceding.matchAll(/\S+/gu)]
    const contextStart = words.length > 4 ? words[words.length - 4].index : 0
    const followingWords = [...following.matchAll(/\S+/gu)]
    const contextEnd =
      followingWords.length > 4
        ? followingWords[3].index + followingWords[3][0].length
        : following.length

    yield {
      offset: Array.from(preceding).length,
      before: preceding.slice(contextStart),
      match: query,
      after: following.slice(0, contextEnd),
    }
    start = text.indexOf(query, end)
  }
}

export async function searchBookText(scope: ReaderScope, query: string) {
  if (!isSearchQueryValid(query)) throw new Error('Enter a search phrase.')

  return database.transaction(
    'r',
    [database.content, database.sections, database.segments],
    async () => {
      const content = await database.content.get(scope.bookId)
      if (!content?.complete || content.version !== scope.contentVersion)
        throw new Error('Download this book before searching.')

      const sections = await database.sections
        .where('[bookId+version]')
        .equals([scope.bookId, scope.contentVersion])
        .toArray()
      const titles = new Map(
        sections.map((section) => [section.id, section.title]),
      )
      const segments = database.segments
        .where('[bookId+version+sequence]')
        .between(
          [scope.bookId, scope.contentVersion, Dexie.minKey],
          [scope.bookId, scope.contentVersion, Dexie.maxKey],
          true,
          true,
        )
      if (
        sections.length !== content.manifest.section_count ||
        (await segments.count()) !== content.manifest.segment_count
      )
        throw new Error('Download this book before searching.')

      const results: TextSearchResult[] = []
      let rootId: number | null = null
      // A cursor releases each segment after scanning; only result fragments survive.
      await segments.each((segment) => {
        rootId = segment.root_section_id ?? rootId
        for (const match of findTextMatches(segment.text_content, query))
          results.push({
            ...match,
            segmentId: segment.id,
            chapterId: rootId === null ? 'before' : String(rootId),
            chapterTitle:
              rootId === null ? 'Before' : (titles.get(rootId) ?? ''),
          })
      })
      return results
    },
  )
}
