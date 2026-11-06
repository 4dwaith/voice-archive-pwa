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
  resolveAnchorPage,
  resolvePageSectionSelection,
} from '../hooks/resolveAnchorPage'
import { resolvePageNumber } from '../components/atoms/ReaderProgressNavigation/resolvePageNumber'
import type {
  ReaderAnchor,
  ReaderBookStatus,
  ReaderScope,
  StoredReaderMeasurement,
} from '../models/reader'
import {
  completePageNavigation,
  getPageNavigationIntent,
  getReaderScope,
  getReaderAnchor,
  getLayoutKey,
  getSelectedSectionId,
} from './readerSlice'
import type { AppDispatch, RootState } from './store'

type PageNavigationData = {
  scope: ReaderScope
  ready: ReaderBookStatus | null
  pages: {
    chapterId: string
    page: StoredReaderMeasurement['pages'][number]
  }[]
  selectedSectionId: number | null
}

async function readPageDestination(
  { scope, ready, pages, selectedSectionId }: PageNavigationData,
  desiredPage: number,
) {
  const pageNumber = resolvePageNumber(desiredPage, pages.length)
  const destination = pageNumber === null ? undefined : pages[pageNumber - 1]
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
    anchor,
    sectionId: anchor
      ? resolvePageSectionSelection(
          anchor,
          segments ?? [],
          ready?.sections ?? [],
          selectedSectionId,
          destinationChapter === 'before' ? 0 : Number(destinationChapter),
        )
      : null,
  }
}

async function readRelativePageDestination(
  data: PageNavigationData,
  currentAnchor: ReaderAnchor,
  chapterId: string | undefined,
  delta: number,
) {
  const { scope, ready, pages, selectedSectionId } = data
  if (!ready || !chapterId) return null
  const localPage = resolveAnchorPage(
    currentAnchor,
    (await readChapterSegments(
      scope.bookId,
      scope.contentVersion,
      chapterId,
    )) ?? [],
    ready.measurementsByChapter.get(chapterId),
  )
  if (localPage === null)
    return ready.measurementsByChapter.has(chapterId)
      ? { anchor: null, sectionId: null }
      : null
  const currentIndex = pages.findIndex(
    (item) => item.chapterId === chapterId && item.page.localPage === localPage,
  )
  if (currentIndex < 0) return null
  const desiredPage = currentIndex + 1 + delta
  if (
    desiredPage < 1 ||
    (desiredPage > pages.length && ready.totalPageCount !== null)
  )
    return { anchor: currentAnchor, sectionId: selectedSectionId }
  // The indexed prefix is not a true book edge while content/layout is preparing.
  if (desiredPage > pages.length && ready.totalPageCount === null) return null
  return readPageDestination(data, desiredPage)
}

async function readRequestedPageDestination(
  scope: ReaderScope,
  request: NonNullable<ReturnType<typeof getPageNavigationIntent>>,
  layoutKey: string,
  currentAnchor: ReaderAnchor,
  selectedSectionId: number | null,
) {
  const ready = await readReaderChapterReadiness(
    scope.bookId,
    scope.contentVersion,
    layoutKey,
  )
  const anchorSegment = await database.segments
    .where('[bookId+version+id]')
    .equals([scope.bookId, scope.contentVersion, currentAnchor.segmentId])
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
    (ready?.measurementsByChapter.get(id)?.pages ?? []).map((page) => ({
      chapterId: id,
      page,
    })),
  )
  const data = {
    scope,
    ready,
    pages,
    selectedSectionId,
  }
  return request.relativeDelta
    ? readRelativePageDestination(
        data,
        currentAnchor,
        chapterId,
        request.relativeDelta,
      )
    : readPageDestination(data, request.pageNumber)
}

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
          () =>
            readRequestedPageDestination(
              scope,
              request,
              layoutKey,
              currentAnchor,
              getSelectedSectionId(state),
            ),
        ),
      )

      let finish!: () => void
      const completed = new Promise<void>((resolve) => {
        finish = resolve
      })
      const subscription = destination.subscribe({
        next: (result) => {
          if (!result || api.signal.aborted) return
          api.dispatch(completePageNavigation({ ...target, ...result }))
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
