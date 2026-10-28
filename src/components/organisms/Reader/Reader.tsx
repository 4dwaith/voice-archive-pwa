import { useCallback, useState } from 'react'
import { ReaderProvider } from '../../../contexts/ReaderProvider'
import { ReaderPage } from '../../atoms/ReaderPage/ReaderPage'
import { PageMeasurer } from '../../molecules/PageMeasurer/PageMeasurer'
import { readChapterSegments } from '../../../data/readerChapterRepository'
import { useAppSelector } from '../../../store/hooks'
import { getMeasurementSave } from '../../../store/readerSlice'

export function Reader({
  bookId,
  contentVersion,
}: {
  bookId: number
  contentVersion: string
}) {
  const [retryKey, setRetryKey] = useState(0)
  const save = useAppSelector(getMeasurementSave)
  const loadChapterSegments = useCallback(
    (chapterId: string) =>
      readChapterSegments(bookId, contentVersion, chapterId),
    [bookId, contentVersion],
  )

  return (
    <ReaderProvider bookId={bookId} contentVersion={contentVersion}>
      {({
        chapterInfo,
        currentChapterId,
        currentChapterSegments,
        layoutKey,
      }) => (
        <div className="relative h-full w-full" data-reader>
          <ReaderPage segments={currentChapterSegments} label="Book text" />
          <div className="pointer-events-none absolute inset-0">
            {chapterInfo && (
              <PageMeasurer
                bookId={bookId}
                contentVersion={contentVersion}
                {...chapterInfo}
                chapterIds={
                  currentChapterId
                    ? [
                        // Prioritize measuring the current chapter
                        currentChapterId,
                        ...chapterInfo.chapterIds.filter(
                          (id) => id !== currentChapterId,
                        ),
                      ]
                    : chapterInfo.chapterIds
                }
                layoutKey={layoutKey}
                loadChapterSegments={loadChapterSegments}
                retryKey={retryKey}
              />
            )}
          </div>
          {save?.bookId === bookId &&
            save.contentVersion === contentVersion &&
            save.layoutKey === layoutKey &&
            (save.outcome === 'failed' || save.outcome === 'rejected') && (
              <div
                role="alert"
                className="absolute inset-x-0 bottom-0 bg-page p-4"
              >
                <p>Page preparation could not be saved.</p>
                <button
                  type="button"
                  className="min-h-12 rounded-xl border-2 border-ink px-4 font-bold focus-visible:outline-4 focus-visible:outline-accent"
                  onClick={() => setRetryKey((key) => key + 1)}
                >
                  Retry page preparation
                </button>
              </div>
            )}
        </div>
      )}
    </ReaderProvider>
  )
}
