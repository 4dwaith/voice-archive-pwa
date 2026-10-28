import { useLiveQuery } from 'dexie-react-hooks'
import { readReaderChapterReadiness } from '../data/readerChapterRepository'

export function useReaderChapters(
  bookId: number,
  contentVersion: string,
  layoutKey: string | null,
) {
  const chapterReadinessSnapshot = useLiveQuery(
    async () => ({
      bookId,
      contentVersion,
      layoutKey,
      chapters: await readReaderChapterReadiness(
        bookId,
        contentVersion,
        layoutKey,
      ),
    }),
    [bookId, contentVersion, layoutKey],
  )

  // useLiveQuery can retain its last value while new dependencies are queried.
  const hasCurrentChapterReadiness =
    chapterReadinessSnapshot?.bookId === bookId &&
    chapterReadinessSnapshot.contentVersion === contentVersion &&
    chapterReadinessSnapshot.layoutKey === layoutKey

  return {
    isLoading: !hasCurrentChapterReadiness,
    chapters: hasCurrentChapterReadiness
      ? chapterReadinessSnapshot.chapters
      : undefined,
  }
}
