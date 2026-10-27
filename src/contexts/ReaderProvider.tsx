import { useMemo, type ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  requestPageNavigation,
  getGlobalPage,
  getTotalPageCount,
  getIndexedPageCount,
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
  setCurrentPage,
  reportPageCount,
  getSelectedSegmentId,
  getHighlightedSegmentId,
  getCurrentPage,
  getPageCount,
} from '../store/readerSlice'
import { selectTextSizePercent } from '../store/textSizeSlice'
import { ReaderContext, type ReaderContextValue } from './ReaderContext'

// Reader content is passed to components; this adapter supplies shared state/actions.
export function ReaderProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const selectedSectionId = useAppSelector(getSelectedSectionId)
  const isSectionExpanded = useAppSelector(getSectionExpansionPredicate)
  const tocPresentation = useAppSelector(getTocPresentation)
  const selectedSegmentId = useAppSelector(getSelectedSegmentId)
  const highlightedSegmentId = useAppSelector(getHighlightedSegmentId)
  const currentPage = useAppSelector(getCurrentPage)
  const pageCount = useAppSelector(getPageCount)
  const globalPage = useAppSelector(getGlobalPage)
  const totalPageCount = useAppSelector(getTotalPageCount)
  const indexedPageCount = useAppSelector(getIndexedPageCount)
  const hasPendingPageNavigation = useAppSelector(isPageNavigationPending)
  const textSizePercent = useAppSelector(selectTextSizePercent)
  const actions = useMemo<{
    toc: Pick<
      ReaderContextValue['toc'],
      'selectSection' | 'setSectionExpanded' | 'setTocPresentation'
    >
    navigation: Pick<
      ReaderContextValue['navigation'],
      'requestPageNavigation' | 'setCurrentPage' | 'reportPageCount'
    >
    reader: Pick<
      ReaderContextValue['reader'],
      'selectSegment' | 'highlightSegment' | 'reportSegmentError'
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
        requestPageNavigation: (intent) => {
          dispatch(requestPageNavigation(intent))
        },
        setCurrentPage: (pageNumber) => {
          dispatch(setCurrentPage(pageNumber))
        },
        reportPageCount: (count) => {
          dispatch(reportPageCount(count))
        },
      },
      reader: {
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
    [dispatch],
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
        currentPage,
        pageCount,
        globalPage,
        totalPageCount,
        indexedPageCount,
        isPageNavigationPending: hasPendingPageNavigation,
        ...actions.navigation,
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
      globalPage,
      totalPageCount,
      indexedPageCount,
      hasPendingPageNavigation,
      textSizePercent,
      selectedSegmentId,
      highlightedSegmentId,
      actions,
    ],
  )

  return <ReaderContext value={value}>{children}</ReaderContext>
}
