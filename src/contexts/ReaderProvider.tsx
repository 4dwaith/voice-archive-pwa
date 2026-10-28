import { useMemo, type ReactNode } from 'react'
import { useReaderNavigation } from '../hooks/useReaderNavigation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  reportLayoutKey,
  setPageScope,
  getPageScope,
  requestPageNavigation,
  isPageNavigationPending,
  selectSection,
  setSectionExpanded,
  setTocPresentation,
  getSelectedSectionId,
  getSectionExpansionPredicate,
  getTocPresentation,
  selectSegment,
  highlightSegment,
  reportSegmentError,
  reportPageMeasurement,
  getSelectedSegmentId,
  getHighlightedSegmentId,
} from '../store/readerSlice'
import { selectTextSizePercent } from '../store/textSizeSlice'
import { ReaderContext, type ReaderContextValue } from './ReaderContext'

// Reader content is passed to components; this adapter supplies shared state/actions.
export function ReaderProvider({
  children,
  bookId,
  contentVersion,
}: {
  children:
    ReactNode | ((data: ReturnType<typeof useReaderNavigation>) => ReactNode)
  bookId?: number
  contentVersion?: string
}) {
  const dispatch = useAppDispatch()
  const navigation = useReaderNavigation(bookId, contentVersion)
  const {
    currentPage,
    pageCount,
    globalPage,
    totalPageCount,
    indexedPageCount,
    setCurrentPage,
  } = navigation
  const selectedSectionId = useAppSelector(getSelectedSectionId)
  const isSectionExpanded = useAppSelector(getSectionExpansionPredicate)
  const tocPresentation = useAppSelector(getTocPresentation)
  const selectedSegmentId = useAppSelector(getSelectedSegmentId)
  const highlightedSegmentId = useAppSelector(getHighlightedSegmentId)
  const pageScope = useAppSelector(getPageScope)
  const hasPendingPageNavigation = useAppSelector(isPageNavigationPending)
  const textSizePercent = useAppSelector(selectTextSizePercent)
  const actions = useMemo<{
    toc: Pick<
      ReaderContextValue['toc'],
      'selectSection' | 'setSectionExpanded' | 'setTocPresentation'
    >
    navigation: Pick<
      ReaderContextValue['navigation'],
      'requestPageNavigation' | 'reportPageMeasurement' | 'setPageScope'
    >
    reader: Pick<
      ReaderContextValue['reader'],
      | 'selectSegment'
      | 'highlightSegment'
      | 'reportSegmentError'
      | 'reportLayoutKey'
    >
  }>(
    () => ({
      toc: {
        selectSection: (sectionId) => {
          dispatch(selectSection(sectionId))
        },
        setSectionExpanded: (change) => {
          dispatch(setSectionExpanded(change))
        },
        setTocPresentation: (presentation) => {
          dispatch(setTocPresentation(presentation))
        },
      },
      navigation: {
        setPageScope: (scope) => {
          dispatch(setPageScope(scope))
        },
        requestPageNavigation: (intent) => {
          dispatch(requestPageNavigation(intent))
        },
        reportPageMeasurement: (report) => {
          if (bookId !== undefined && contentVersion)
            dispatch(
              reportPageMeasurement({ ...report, bookId, contentVersion }),
            )
        },
      },
      reader: {
        reportLayoutKey: (key) => {
          dispatch(reportLayoutKey(key))
        },
        selectSegment: (segmentId) => {
          dispatch(selectSegment(segmentId))
        },
        highlightSegment: (segmentId) => {
          dispatch(highlightSegment(segmentId))
        },
        reportSegmentError: (report) => {
          dispatch(reportSegmentError(report))
        },
      },
    }),
    [dispatch, bookId, contentVersion],
  )
  const value = useMemo<ReaderContextValue>(
    () => ({
      toc: {
        selectedSectionId,
        isSectionExpanded,
        tocPresentation,
        ...actions.toc,
      },
      navigation: {
        pageScope,
        currentPage: currentPage ?? 1,
        pageCount,
        globalPage,
        totalPageCount,
        indexedPageCount,
        isPageNavigationPending: hasPendingPageNavigation,
        ...actions.navigation,
        setCurrentPage,
      },
      reader: {
        textSizePercent,
        selectedSegmentId,
        highlightedSegmentId,
        ...actions.reader,
      },
    }),
    [
      selectedSectionId,
      isSectionExpanded,
      tocPresentation,
      currentPage,
      pageCount,
      pageScope,
      globalPage,
      totalPageCount,
      indexedPageCount,
      hasPendingPageNavigation,
      textSizePercent,
      selectedSegmentId,
      highlightedSegmentId,
      actions,
      setCurrentPage,
    ],
  )

  return (
    <ReaderContext value={value}>
      {typeof children === 'function' ? children(navigation) : children}
    </ReaderContext>
  )
}
