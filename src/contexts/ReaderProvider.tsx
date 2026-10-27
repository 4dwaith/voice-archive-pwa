import { useMemo, type ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
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
  const textSizePercent = useAppSelector(selectTextSizePercent)
  const actions = useMemo<
    Pick<
      ReaderContextValue,
      | 'selectSegment'
      | 'highlightSegment'
      | 'reportSegmentError'
      | 'setCurrentPage'
      | 'reportPageCount'
      | 'selectSection'
      | 'setSectionExpanded'
      | 'setTocPresentation'
    >
  >(
    () => ({
      selectSection: (sectionId) => {
        dispatch(selectSection(sectionId))
      },
      setSectionExpanded: (change) => {
        dispatch(setSectionExpanded(change))
      },
      setTocPresentation: (presentation) => {
        dispatch(setTocPresentation(presentation))
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
      setCurrentPage: (pageNumber) => {
        dispatch(setCurrentPage(pageNumber))
      },
      reportPageCount: (count) => {
        dispatch(reportPageCount(count))
      },
    }),
    [dispatch],
  )
  const value = useMemo<ReaderContextValue>(
    () => ({
      selectedSectionId,
      isSectionExpanded,
      tocPresentation,
      currentPage,
      pageCount,
      textSizePercent,
      selectedSegmentId,
      highlightedSegmentId,
      ...actions,
    }),
    [
      selectedSectionId,
      isSectionExpanded,
      tocPresentation,
      currentPage,
      pageCount,
      textSizePercent,
      selectedSegmentId,
      highlightedSegmentId,
      actions,
    ],
  )

  return <ReaderContext value={value}>{children}</ReaderContext>
}
