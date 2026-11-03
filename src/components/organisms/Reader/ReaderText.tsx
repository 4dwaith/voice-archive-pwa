import { useCallback, useState } from 'react'
import { Header } from '../../../layout/Header'
import { ReaderSearch } from '../../molecules/ReaderSearch/ReaderSearch'
import { ReaderTableOfContents } from '../../atoms/ReaderTableOfContents/ReaderTableOfContents'
import { ReaderProgressNavigation } from '../../atoms/ReaderProgressNavigation/ReaderProgressNavigation'
import { ReaderPage } from '../../atoms/ReaderPage/ReaderPage'
import { PageMeasurer } from '../../molecules/PageMeasurer/PageMeasurer'
import { readChapterSegments } from '../../../data/readerChapterRepository'
import { useAppSelector } from '../../../store/hooks'
import {
  getMeasurementSave,
  getTocNavigationError,
  getPageNavigationError,
} from '../../../store/readerSlice'

import type { ReaderNavigation } from '../../../hooks/useReaderNavigation'
import { ReaderModeSwitch } from '../../molecules/ReaderControls/ReaderModeSwitch'

export function ReaderTextControls({
  sections,
}: {
  sections: ReaderNavigation['tocSections']
}) {
  const pageError = useAppSelector(getPageNavigationError)
  const tocError = useAppSelector(getTocNavigationError)
  return (
    <>
      <Header actions={<ReaderModeSwitch />}>
        <ReaderSearch />
      </Header>
      <div className="flex min-h-0 w-72 max-w-full flex-1 flex-col border-2 border-ink has-[[data-presentation=collapsed]]:flex-none [&>nav]:min-h-0 [&>nav]:flex-1">
        <ReaderTableOfContents sections={sections} />
        {tocError && (
          <p role="status" className="bg-page p-2">
            {tocError}
          </p>
        )}
      </div>
      <div className="mt-auto shrink-0">
        <ReaderProgressNavigation message={pageError ?? undefined} />
      </div>
    </>
  )
}

export function ReaderText({
  bookId,
  contentVersion,
  navigation,
}: {
  bookId: number
  contentVersion: string
  navigation: ReaderNavigation
}) {
  const { chapterInfo, currentChapterId, currentChapterSegments, layoutKey } =
    navigation
  const [retryKey, setRetryKey] = useState(0)
  const save = useAppSelector(getMeasurementSave)
  const loadChapterSegments = useCallback(
    (chapterId: string) =>
      readChapterSegments(bookId, contentVersion, chapterId),
    [bookId, contentVersion],
  )

  return (
    <div className="relative h-full w-full">
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
            className="absolute inset-x-0 bottom-0 z-30 bg-page p-4"
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
  )
}
