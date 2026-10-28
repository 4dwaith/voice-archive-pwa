import { useEffect, useMemo } from 'react'
import { readReaderPreferences } from '../data/readerPreferences'
import { getGraphemeBoundaries } from '../components/atoms/ReaderChapterLayout/getGraphemeBoundaries'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ReaderPageNavigation, ReaderSection } from '../models/reader'
import { database } from '../data/database'
import {
  readChapterSegments,
  readReaderChapterReadiness,
} from '../data/readerChapterRepository'
import { sanitizeReaderSegment } from '../components/atoms/ReaderSegmentContent/sanitizeReaderSegment'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  hasReaderNavigated,
  openReader,
  closeReader,
  reconcileReaderAnchor,
  setReaderAnchor,
  getReaderAnchor,
  getReaderScope,
  getLayoutKey,
  getSelectedSectionId,
  getPageNavigationIntent,
  requestPageNavigation,
  completePageNavigation,
} from '../store/readerSlice'
import { resolvePageNumber } from '../components/atoms/ReaderProgressNavigation/resolvePageNumber'
import {
  resolveAnchorPage,
  resolvePageStart,
  resolvePageSectionSelection,
} from './resolveAnchorPage'

export function useReaderNavigation(
  bookId?: number,
  contentVersion?: string,
  restorePosition = true,
) {
  const dispatch = useAppDispatch()
  const scope = useAppSelector(getReaderScope)
  const anchor = useAppSelector(getReaderAnchor)
  const hasNavigated = useAppSelector(hasReaderNavigated)
  const savedPosition = useMemo(() => {
    const position =
      restorePosition && bookId !== undefined
        ? readReaderPreferences().positions[bookId]
        : undefined
    return position?.version === contentVersion ? position : undefined
  }, [bookId, contentVersion, restorePosition])
  const selectedSectionId = useAppSelector(getSelectedSectionId)
  const intent = useAppSelector(getPageNavigationIntent)
  const layoutKey = useAppSelector(getLayoutKey)

  const isActive =
    scope?.bookId === bookId && scope?.contentVersion === contentVersion

  // Tag each query result with the position and layout that produced it.
  const queryKey = JSON.stringify([
    bookId,
    contentVersion,
    layoutKey,
    hasNavigated,
    isActive ? anchor : null,
  ])

  useEffect(
    function synchronizeReaderScope() {
      if (bookId === undefined || !contentVersion) return

      const target = { bookId, contentVersion }
      dispatch(openReader(target))

      return () => {
        dispatch(closeReader(target))
      }
    },
    [bookId, contentVersion, dispatch],
  )

  // Read content and committed measurements together as downloads and layout saves arrive.
  const snapshot = useLiveQuery(async () => {
    if (bookId === undefined || !contentVersion || !isActive) return undefined

    return database.transaction(
      'r',
      [
        database.content,
        database.sections,
        database.segments,
        database.measurements,
      ],
      async () => {
        const content = await database.content.get(bookId)
        const hasContent = content?.version === contentVersion
        const chapterInfo = await readReaderChapterReadiness(
          bookId,
          contentVersion,
          layoutKey,
        )

        let anchorSegment = anchor
          ? await database.segments
              .where('[bookId+version+id]')
              .equals([bookId, contentVersion, anchor.segmentId])
              .first()
          : undefined

        let openingOffset = 0
        if (!anchor && !hasNavigated && savedPosition && hasContent) {
          const savedSegment = await database.segments
            .where('[bookId+version+source_key]')
            .equals([bookId, contentVersion, savedPosition.sourceKey])
            .first()

          // A missing target is not invalid until the segment stream has ended.
          if (
            !savedSegment &&
            !content.complete &&
            content.progress?.segmentNextOffset !== null
          )
            return {
              queryKey,
              hasContent,
              chapterInfo,
              segments: [],
              firstAnchor: null,
            }

          if (
            savedSegment &&
            sanitizeReaderSegment(savedSegment).isValid &&
            savedSegment.text_content.length > 0 &&
            savedPosition.offset <
              Array.from(savedSegment.text_content).length &&
            getGraphemeBoundaries(savedSegment.text_content).some(
              (boundary) => boundary.codePoint === savedPosition.offset,
            )
          ) {
            anchorSegment = savedSegment
            openingOffset = savedPosition.offset
          }
        }

        // On entry, choose readable text from the available opening chapters.
        // Stop at a download gap rather than skipping ahead to later content.
        if (!anchor && !anchorSegment && chapterInfo) {
          for (const id of chapterInfo.chapterIds) {
            if (!chapterInfo.availableChapterIds.has(id)) break
            const candidates = await readChapterSegments(
              bookId,
              contentVersion,
              id,
            )

            anchorSegment = candidates?.find(
              (candidate) =>
                candidate.text_content.length > 0 &&
                sanitizeReaderSegment(candidate).isValid,
            )

            if (anchorSegment) break
          }
        }

        // Segment sequence ranges identify the chapter containing the anchor.
        const currentChapterId =
          anchorSegment && chapterInfo
            ? chapterInfo.chapterIds.find((id) => {
                const range = chapterInfo.downloadedChapterRanges.get(id)

                return (
                  range &&
                  anchorSegment!.sequence >= range.start &&
                  anchorSegment!.sequence < range.end
                )
              })
            : undefined
        const currentChapterSegments = currentChapterId
          ? await readChapterSegments(bookId, contentVersion, currentChapterId)
          : undefined
        const measurement = currentChapterId
          ? chapterInfo?.measurementsByChapter.get(currentChapterId)
          : undefined

        return {
          queryKey,
          hasContent,
          chapterInfo,
          currentChapterId,
          segments: currentChapterSegments ?? [],
          measurement,
          firstAnchor: anchorSegment
            ? { segmentId: anchorSegment.id, offset: openingOffset }
            : null,
        }
      },
    )
  }, [queryKey, isActive])

  // A live query can still expose its previous result while the next one loads.
  const data =
    isActive && snapshot?.queryKey === queryKey ? snapshot : undefined

  // Initialize a missing anchor, or clear it when this content version disappears.
  useEffect(
    function reconcileAnchorWithContent() {
      if (data && bookId !== undefined && contentVersion)
        dispatch(
          reconcileReaderAnchor({
            bookId,
            contentVersion,
            hasContent: data.hasContent,
            firstAnchor: data.firstAnchor,
          }),
        )
    },
    [data, bookId, contentVersion, dispatch],
  )

  // Page numbers are derived from the text anchor for the current layout.
  const currentPage = resolveAnchorPage(
    anchor,
    data?.segments ?? [],
    data?.measurement,
  )
  const chapterInfo = data?.chapterInfo
  const chapterId = data?.currentChapterId
  const prefixIndex = chapterId
    ? (chapterInfo?.indexedChapterIds.indexOf(chapterId) ?? -1)
    : -1

  // Book numbering is known only within the contiguous indexed chapter prefix.
  const globalPage =
    currentPage !== null && chapterInfo && prefixIndex >= 0
      ? currentPage +
        chapterInfo.indexedChapterIds
          .slice(0, prefixIndex)
          .reduce((sum, id) => sum + chapterInfo.countsByChapter.get(id)!, 0)
      : null

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
  if (before && before.end > before.start)
    tocSections.unshift({
      id: 0,
      parent_id: null,
      title: 'Before',
      sequence: -1,
      unavailableReason: getUnavailableReason('before'),
    })

  function setCurrentPage(pageNumber: number) {
    const anchor = resolvePageStart(
      pageNumber,
      data?.segments ?? [],
      data?.measurement,
    )

    if (anchor && bookId !== undefined && contentVersion)
      dispatch(
        setReaderAnchor({
          bookId,
          contentVersion,
          anchor,
          sectionId: resolvePageSectionSelection(
            anchor,
            data?.segments ?? [],
            sections,
            selectedSectionId,
            chapterId === 'before' ? 0 : Number(chapterId),
          ),
        }),
      )
  }

  // Supply current bounds; the reducer orders and accumulates navigation requests.
  function requestNavigation(request: ReaderPageNavigation) {
    dispatch(
      requestPageNavigation({
        ...request,
        currentPage: request.scope === 'local' ? currentPage : globalPage,
        pageCount:
          request.scope === 'local'
            ? (data?.measurement?.pages.length ?? null)
            : (chapterInfo?.indexedPageCount ?? null),
      }),
    )
  }

  useEffect(
    function resolvePendingPageNavigation() {
      if (
        !intent ||
        !data ||
        !layoutKey ||
        bookId === undefined ||
        !contentVersion
      )
        return

      // Capture the request identity so Redux can reject a stale completion.
      const request = intent
      const snapshot = data
      const targetScope = {
        bookId,
        contentVersion,
        layoutKey,
        requestId: request.requestId,
      }
      let isCancelled = false

      async function resolveDestination() {
        try {
          const ready = snapshot.chapterInfo

          // Retain the desired page while matching committed data is preparing.
          if (
            ready &&
            (request.scope === 'local'
              ? !snapshot.measurement
              : ready.indexedPageCount === 0 && ready.totalPageCount === null)
          )
            return

          // Flatten only the requested scope, retaining each page's chapter identity.
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

          const pageNumber = resolvePageNumber(request.pageNumber, pages.length)
          const destination =
            pageNumber === null ? undefined : pages[pageNumber - 1]
          const destinationChapter = destination?.chapterId
          const measurement = destinationChapter
            ? ready?.measurementsByChapter.get(destinationChapter)
            : undefined

          // Cross-chapter jumps need the destination text to validate its page start.
          const segments =
            destinationChapter === chapterId
              ? snapshot.segments
              : destinationChapter
                ? await readChapterSegments(
                    targetScope.bookId,
                    targetScope.contentVersion,
                    destinationChapter,
                  )
                : []

          const anchor = destination
            ? resolvePageStart(
                destination.page.localPage,
                segments ?? [],
                measurement,
              )
            : null

          if (!isCancelled)
            dispatch(
              completePageNavigation({
                ...targetScope,
                anchor,
                sectionId: anchor
                  ? resolvePageSectionSelection(
                      anchor,
                      segments ?? [],
                      ready?.sections ?? [],
                      selectedSectionId,
                      destinationChapter === 'before'
                        ? 0
                        : Number(destinationChapter),
                    )
                  : null,
              }),
            )
        } catch {
          // A failed lookup completes with no anchor, preserving the reading position.
          if (!isCancelled)
            dispatch(
              completePageNavigation({
                ...targetScope,
                anchor: null,
                sectionId: null,
              }),
            )
        }
      }

      void resolveDestination()

      // Dependency changes abandon this lookup; the next effect uses fresh data.
      return () => {
        isCancelled = true
      }
    },
    [
      intent,
      selectedSectionId,
      data,
      layoutKey,
      bookId,
      contentVersion,
      chapterId,
      chapterInfo,
      dispatch,
    ],
  )

  return {
    chapterInfo,
    tocSections,
    currentChapterId: chapterId,
    currentChapterSegments: data?.segments ?? [],
    layoutKey,
    currentPage,
    globalPage,
    pageCount: data?.measurement?.pages.length ?? null,
    totalPageCount: chapterInfo?.totalPageCount ?? null,
    indexedPageCount: chapterInfo?.indexedPageCount ?? 0,
    setCurrentPage,
    requestNavigation,
  }
}
