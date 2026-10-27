import { useMemo, type ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  selectSegment,
  highlightSegment,
  reportSegmentError,
  selectSelectedSegmentId,
  selectHighlightedSegmentId,
} from '../store/readerSlice'
import { ReaderContext, type ReaderContextValue } from './ReaderContext'

// The only reader UI adapter to Redux. Content remains in read models/Dexie.
export function ReaderProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const selectedSegmentId = useAppSelector(selectSelectedSegmentId)
  const highlightedSegmentId = useAppSelector(selectHighlightedSegmentId)
  const actions = useMemo<
    Pick<
      ReaderContextValue,
      'selectSegment' | 'highlightSegment' | 'reportSegmentError'
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
    }),
    [dispatch],
  )
  const value = useMemo<ReaderContextValue>(
    () => ({ selectedSegmentId, highlightedSegmentId, ...actions }),
    [selectedSegmentId, highlightedSegmentId, actions],
  )
  return <ReaderContext value={value}>{children}</ReaderContext>
}
