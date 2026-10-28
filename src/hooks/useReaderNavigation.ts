import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ReaderSection } from '../models/reader'
import { database } from '../data/database'
import {
  readChapterSegments,
  readReaderChapterReadiness,
} from '../data/readerChapterRepository'
import { sanitizeReaderSegment } from '../components/atoms/ReaderSegmentContent/sanitizeReaderSegment'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  openReader,
  closeReader,
  reconcileReaderAnchor,
  setReaderAnchor,
  getReaderAnchor,
  getReaderScope,
  getLayoutKey,
} from '../store/readerSlice'
import { resolveAnchorPage } from './resolveAnchorPage'

export function useReaderNavigation(bookId?: number, contentVersion?: string) {
  const dispatch = useAppDispatch()
  const scope = useAppSelector(getReaderScope)
  const anchor = useAppSelector(getReaderAnchor)
  const layoutKey = useAppSelector(getLayoutKey)
  const isActive =
    scope?.bookId === bookId && scope?.contentVersion === contentVersion
  const queryKey = JSON.stringify([
    bookId,
    contentVersion,
    layoutKey,
    isActive ? anchor : null,
  ])

  useEffect(() => {
    if (bookId === undefined || !contentVersion) return
    const target = { bookId, contentVersion }
    dispatch(openReader(target))
    return () => {
      dispatch(closeReader(target))
    }
  }, [bookId, contentVersion, dispatch])

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
        if (!anchor && chapterInfo) {
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
            ? { segmentId: anchorSegment.id, offset: 0 }
            : null,
        }
      },
    )
  }, [queryKey, isActive])
  const data =
    isActive && snapshot?.queryKey === queryKey ? snapshot : undefined

  useEffect(() => {
    if (data && bookId !== undefined && contentVersion)
      dispatch(
        reconcileReaderAnchor({
          bookId,
          contentVersion,
          hasContent: data.hasContent,
          firstAnchor: data.firstAnchor,
        }),
      )
  }, [data, bookId, contentVersion, dispatch])

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
    const start = data?.measurement?.pages.find(
      (page) => page.localPage === pageNumber,
    )?.start
    if (
      start &&
      bookId !== undefined &&
      contentVersion &&
      resolveAnchorPage(start, data.segments, data.measurement) === pageNumber
    )
      dispatch(
        setReaderAnchor({
          bookId,
          contentVersion,
          anchor: { segmentId: start.segmentId, offset: start.offset },
        }),
      )
  }

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
  }
}
