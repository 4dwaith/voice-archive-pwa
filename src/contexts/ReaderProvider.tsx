import { useMemo, type ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  selectSegment,
  highlightSegment,
  reportSegmentError,
  setCurrentPage,
  reportPageCount,
  selectSelectedSegmentId,
  selectHighlightedSegmentId,
  selectCurrentPage,
  selectPageCount,
} from '../store/readerSlice'
import { selectTextSizePercent } from '../store/textSizeSlice'
import { ReaderContext, type ReaderContextValue } from './ReaderContext'

// Reader content is passed to components; this adapter supplies shared state/actions.
export function ReaderProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const selectedSegmentId = useAppSelector(selectSelectedSegmentId)
  const highlightedSegmentId = useAppSelector(selectHighlightedSegmentId)
  const currentPage = useAppSelector(selectCurrentPage)
  const pageCount = useAppSelector(selectPageCount)
  const textSizePercent = useAppSelector(selectTextSizePercent)
  const actions = useMemo<
    Pick<
      ReaderContextValue,
      | 'selectSegment'
      | 'highlightSegment'
      | 'reportSegmentError'
      | 'setCurrentPage'
      | 'reportPageCount'
    >
  >(
    () => ({
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
      currentPage,
      pageCount,
      textSizePercent,
      selectedSegmentId,
      highlightedSegmentId,
      ...actions,
    }),
    [
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
