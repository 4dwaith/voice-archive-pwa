import { createListenerMiddleware } from '@reduxjs/toolkit'
import { liveQuery } from 'dexie'
import { database } from '../data/database'
import {
  readChapterSegments,
  readReaderChapterReadiness,
} from '../data/readerChapterRepository'
import { locateChapter } from '../hooks/deriveReaderNavigation'
import {
  resolvePageStart,
  resolvePageSectionSelection,
} from '../hooks/resolveAnchorPage'
import { resolvePageNumber } from '../components/atoms/ReaderProgressNavigation/resolvePageNumber'
import {
  completePageNavigation,
  getPageNavigationIntent,
  getReaderScope,
  getReaderAnchor,
  getLayoutKey,
  getSelectedSectionId,
} from './readerSlice'
import type { AppDispatch, RootState } from './store'

export function createReaderNavigationListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  listener.startListening({
    predicate: (_, current, previous) =>
      [
        getPageNavigationIntent,
        getReaderScope,
        getReaderAnchor,
        getLayoutKey,
        getSelectedSectionId,
      ].some((select) => select(current) !== select(previous)),
    effect: async (_, api) => {
      api.cancelActiveListeners()
      const state = api.getState()
      const scope = getReaderScope(state)
      const request = getPageNavigationIntent(state)
      const layoutKey = getLayoutKey(state)
      const currentAnchor = getReaderAnchor(state)
      if (!scope || !request || !layoutKey || !currentAnchor) return
      const target = { ...scope, layoutKey, requestId: request.requestId }

      // Observe committed data only for the lifetime of this pending intent.
      const destination = liveQuery(() =>
        database.transaction(
          'r',
          [
            database.content,
            database.sections,
            database.segments,
            database.measurements,
          ],
          async () => {
            const ready = await readReaderChapterReadiness(
              scope.bookId,
              scope.contentVersion,
              layoutKey,
            )
            const anchorSegment = await database.segments
              .where('[bookId+version+id]')
              .equals([
                scope.bookId,
                scope.contentVersion,
                currentAnchor.segmentId,
              ])
              .first()
            const chapterId =
              ready && anchorSegment
                ? locateChapter(
                    anchorSegment.sequence,
                    ready.chapterIds,
                    ready.downloadedChapterRanges,
                  )
                : undefined
            // Keep the desired page while the current layout/download is preparing.
            if (
              ready &&
              (request.scope === 'local'
                ? !chapterId || !ready.measurementsByChapter.has(chapterId)
                : ready.indexedPageCount === 0 && ready.totalPageCount === null)
            )
              return null

            const chapters =
              request.scope === 'local'
                ? [chapterId ?? '']
                : (ready?.indexedChapterIds ?? [])
            const pages = chapters.flatMap((id) =>
              (ready?.measurementsByChapter.get(id)?.pages ?? []).map(
                (page) => ({
                  chapterId: id,
                  page,
                }),
              ),
            )
            const pageNumber = resolvePageNumber(
              request.pageNumber,
              pages.length,
            )
            const destination =
              pageNumber === null ? undefined : pages[pageNumber - 1]
            const destinationChapter = destination?.chapterId
            const segments = destinationChapter
              ? await readChapterSegments(
                  scope.bookId,
                  scope.contentVersion,
                  destinationChapter,
                )
              : []
            const anchor = destination
              ? resolvePageStart(
                  destination.page.localPage,
                  segments ?? [],
                  ready?.measurementsByChapter.get(destinationChapter!),
                )
              : null
            return {
              ...target,
              anchor,
              sectionId: anchor
                ? resolvePageSectionSelection(
                    anchor,
                    segments ?? [],
                    ready?.sections ?? [],
                    getSelectedSectionId(state),
                    destinationChapter === 'before'
                      ? 0
                      : Number(destinationChapter),
                  )
                : null,
            }
          },
        ),
      )

      let finish!: () => void
      const completed = new Promise<void>((resolve) => {
        finish = resolve
      })
      const subscription = destination.subscribe({
        next: (result) => {
          if (!result || api.signal.aborted) return
          api.dispatch(completePageNavigation(result))
          finish()
        },
        error: () => {
          if (!api.signal.aborted)
            api.dispatch(
              completePageNavigation({
                ...target,
                anchor: null,
                sectionId: null,
              }),
            )
          finish()
        },
      })
      try {
        await api.pause(completed)
      } finally {
        subscription.unsubscribe()
      }
    },
  })
  return listener
}
