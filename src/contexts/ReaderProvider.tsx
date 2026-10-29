import { useMemo, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../data/database'
import { useReaderNavigation } from '../hooks/useReaderNavigation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  reportLayoutKey,
  setReaderAnchor,
  setControlsVisible,
  getAreControlsVisible,
  setPageScope,
  getPageScope,
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
import {
  ReaderContext,
  type ReaderContextValue,
  type ReaderSearchValue,
} from './ReaderContext'
import {
  getSearchResults,
  getSearchResultsQuery,
  getSearchStatus,
  getSearchError,
  isSearchOpen,
  submitReaderSearch,
  setSearchOpen,
  clearReaderSearch,
} from '../store/readerSearchSlice'

// Reader content is passed to components; this adapter supplies shared state/actions.
export function ReaderProvider({
  children,
  bookId,
  contentVersion,
  restorePosition = true,
}: {
  children:
    ReactNode | ((data: ReturnType<typeof useReaderNavigation>) => ReactNode)
  bookId?: number
  restorePosition?: boolean
  contentVersion?: string
}) {
  const dispatch = useAppDispatch()
  const areControlsVisible = useAppSelector(getAreControlsVisible)
  const navigation = useReaderNavigation(
    bookId,
    contentVersion,
    restorePosition,
  )
  const {
    currentPage,
    pageCount,
    globalPage,
    totalPageCount,
    indexedPageCount,
    setCurrentPage,
    requestNavigation,
  } = navigation
  const selectedSectionId = useAppSelector(getSelectedSectionId)
  const isSectionExpanded = useAppSelector(getSectionExpansionPredicate)
  const tocPresentation = useAppSelector(getTocPresentation)
  const selectedSegmentId = useAppSelector(getSelectedSegmentId)
  const highlightedSegmentId = useAppSelector(getHighlightedSegmentId)
  const pageScope = useAppSelector(getPageScope)
  const hasPendingPageNavigation = useAppSelector(isPageNavigationPending)
  const textSizePercent = useAppSelector(selectTextSizePercent)
  const results = useAppSelector(getSearchResults)
  const resultsQuery = useAppSelector(getSearchResultsQuery)
  const status = useAppSelector(getSearchStatus)
  const error = useAppSelector(getSearchError)
  const isOpen = useAppSelector(isSearchOpen)

  const isBookDownloadComplete = useLiveQuery(
    async () => {
      if (bookId === undefined || !contentVersion) return false
      const content = await database.content.get(bookId)
      return content?.version === contentVersion && content.complete
    },
    [bookId, contentVersion],
    false,
  )

  const search = useMemo<ReaderSearchValue | undefined>(() => {
    if (bookId === undefined || !contentVersion || !isBookDownloadComplete)
      return undefined
    const scope = { bookId, contentVersion }
    return {
      results,
      resultsQuery,
      status,
      error,
      isOpen,
      submitQuery: (query) => {
        dispatch(submitReaderSearch({ scope, query }))
      },
      setOpen: (open) => {
        dispatch(setSearchOpen(open))
      },
      clear: () => {
        dispatch(clearReaderSearch())
      },
      openResult: (result) => {
        dispatch(
          setReaderAnchor({
            ...scope,
            anchor: { segmentId: result.segmentId, offset: result.offset },
            sectionId:
              result.chapterId === 'before' ? 0 : Number(result.chapterId),
          }),
        )
      },
    }
  }, [
    bookId,
    contentVersion,
    isBookDownloadComplete,
    results,
    resultsQuery,
    status,
    error,
    isOpen,
    dispatch,
  ])
  const actions = useMemo<{
    toc: Pick<
      ReaderContextValue['toc'],
      'selectSection' | 'setSectionExpanded' | 'setTocPresentation'
    >
    navigation: Pick<
      ReaderContextValue['navigation'],
      'reportPageMeasurement' | 'setPageScope'
    >
    reader: Pick<
      ReaderContextValue['reader'],
      | 'setControlsVisible'
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
        reportPageMeasurement: (report) => {
          if (bookId !== undefined && contentVersion)
            dispatch(
              reportPageMeasurement({ ...report, bookId, contentVersion }),
            )
        },
      },
      reader: {
        setControlsVisible: (isVisible) => {
          dispatch(setControlsVisible(isVisible))
        },
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
        requestPageNavigation: requestNavigation,
      },
      reader: {
        areControlsVisible,
        search,
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
      areControlsVisible,
      search,
      selectedSegmentId,
      highlightedSegmentId,
      actions,
      setCurrentPage,
      requestNavigation,
    ],
  )

  return (
    <ReaderContext value={value}>
      {typeof children === 'function' ? children(navigation) : children}
    </ReaderContext>
  )
}
