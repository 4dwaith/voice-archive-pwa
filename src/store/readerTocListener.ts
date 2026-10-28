import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { getSectionFirstSegment } from '../data/contentRepository'
import { readReaderChapterReadiness } from '../data/readerChapterRepository'
import {
  selectSection,
  openReader,
  closeReader,
  reportLayoutKey,
  setReaderAnchor,
  reportTocNavigationError,
  getReaderScope,
  getLayoutKey,
} from './readerSlice'
import type { RootState, AppDispatch } from './store'

export function createReaderTocListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  listener.startListening({
    matcher: isAnyOf(
      selectSection,
      openReader,
      closeReader,
      reportLayoutKey,
      setReaderAnchor,
    ),
    effect: async (action, api) => {
      if (closeReader.match(action) || setReaderAnchor.match(action)) {
        const previousScope = getReaderScope(api.getOriginalState())
        if (
          previousScope?.bookId !== action.payload.bookId ||
          previousScope.contentVersion !== action.payload.contentVersion
        )
          return
      }
      if (
        reportLayoutKey.match(action) &&
        getLayoutKey(api.getOriginalState()) === action.payload
      )
        return
      api.cancelActiveListeners()
      if (!selectSection.match(action) || action.payload === null) return
      const scope = getReaderScope(api.getState())
      const layoutKey = getLayoutKey(api.getState())
      if (!scope || !layoutKey) return

      try {
        const target = await getSectionFirstSegment(
          scope.bookId,
          scope.contentVersion,
          action.payload,
        )
        if (api.signal.aborted) return
        const readiness = await readReaderChapterReadiness(
          scope.bookId,
          scope.contentVersion,
          layoutKey,
        )
        if (api.signal.aborted) return
        const chapterId =
          target &&
          readiness?.chapterIds.find((id) => {
            const range = readiness.downloadedChapterRanges.get(id)
            return (
              range &&
              target.sequence >= range.start &&
              target.sequence < range.end
            )
          })
        const measurement =
          chapterId && readiness?.readyChapterIds.has(chapterId)
            ? readiness.measurementsByChapter.get(chapterId)
            : undefined
        const hasTarget =
          target &&
          target.text_content.length > 0 &&
          measurement &&
          measurement.pages.length > 0 &&
          !measurement.unmappableSegmentIds.includes(target.id) &&
          (action.payload !== 0 || chapterId === 'before')
        if (hasTarget)
          api.dispatch(
            setReaderAnchor({
              ...scope,
              anchor: { segmentId: target.id, offset: 0 },
            }),
          )
        else
          api.dispatch(
            reportTocNavigationError(
              'No readable text target for this section.',
            ),
          )
      } catch {
        if (!api.signal.aborted)
          api.dispatch(
            reportTocNavigationError(
              'The section could not be opened. Try again.',
            ),
          )
      }
    },
  })
  return listener
}
