import { useCallback, useMemo, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useReaderAudio } from '../hooks/useReaderAudio'
import {
  resolveNarrationPages,
  resolveNarrationTargetId,
} from '../hooks/resolveNarrationPages'
import { database } from '../data/database'
import { apiBaseUrl } from '../api-client/baseApi'
import {
  useReaderNavigation,
  type ReaderNavigation,
} from '../hooks/useReaderNavigation'
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
  reportSegmentError,
  reportPageMeasurement,
  getSelectedSegmentId,
  getReaderAnchor,
  getReaderViewMode,
  setReaderViewMode,
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
  children: ReactNode | ((data: ReaderNavigation) => ReactNode)
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
  const anchor = useAppSelector(getReaderAnchor)
  const hasPendingPageNavigation = useAppSelector(isPageNavigationPending)
  const measurement = navigation.currentChapterId
    ? navigation.chapterInfo?.measurementsByChapter.get(
        navigation.currentChapterId,
      )
    : undefined
  const targetId = resolveNarrationTargetId({
    selectedSegmentId,
    anchor,
    currentPage,
    segments: navigation.currentChapterSegments,
    measurement,
  })
  const {
    elementRef: audioElementRef,
    selectAudioSegment,
    value: playback,
    highlightedSegmentId,
  } = useReaderAudio(bookId, contentVersion, {
    targetId,
    anchor,
    isNavigationPending: hasPendingPageNavigation,
  })
  const viewMode = useAppSelector(getReaderViewMode)
  const setViewMode = useCallback(
    (mode: 'text' | 'pdf') => {
      dispatch(setReaderViewMode(mode))
    },
    [dispatch],
  )
  const displayedSegmentId =
    highlightedSegmentId ??
    (playback.isPlaying ? playback.segment?.id : null) ??
    selectedSegmentId
  const pageScope = useAppSelector(getPageScope)
  const textSizePercent = useAppSelector(selectTextSizePercent)
  const results = useAppSelector(getSearchResults)
  const resultsQuery = useAppSelector(getSearchResultsQuery)
  const status = useAppSelector(getSearchStatus)
  const error = useAppSelector(getSearchError)
  const isOpen = useAppSelector(isSearchOpen)
  // Text selection already has its complete chapter in memory. Use those regions
  // immediately so a same-page selection does not unmount the existing canvas.
  const selectedRegions = navigation.currentChapterSegments.find(
    (segment) => segment.id === displayedSegmentId,
  )?.regions

  const pdfInput = useLiveQuery(async () => {
    if (bookId === undefined || !contentVersion) return undefined
    const content = await database.content.get(bookId)
    if (content?.version !== contentVersion) return undefined
    const file = content.manifest.files.find(
      (file) =>
        file.kind === 'source_pdf' &&
        file.id === content.manifest.source_pdf_file_id,
    )
    const segment =
      displayedSegmentId === null
        ? undefined
        : await database.segments
            .where('[bookId+version+id]')
            .equals([bookId, contentVersion, displayedSegmentId])
            .first()
    return {
      bookId,
      contentVersion,
      selectedSegmentId: displayedSegmentId,
      url: file ? new URL(file.url, apiBaseUrl).href : null,
      regions: segment?.regions ?? [],
      segment: segment ?? null,
    }
  }, [bookId, contentVersion, displayedSegmentId])

  const pdf = useMemo<ReaderContextValue['reader']['pdf']>(
    () => ({
      segmentId: displayedSegmentId,
      url:
        pdfInput?.bookId === bookId &&
        pdfInput?.contentVersion === contentVersion
          ? (pdfInput?.url ?? null)
          : null,
      regions:
        selectedRegions ??
        (pdfInput?.bookId === bookId &&
        pdfInput?.contentVersion === contentVersion &&
        pdfInput?.selectedSegmentId === displayedSegmentId
          ? (pdfInput?.regions ?? [])
          : []),
      viewMode,
      setViewMode,
    }),
    [
      bookId,
      contentVersion,
      displayedSegmentId,
      selectedRegions,
      pdfInput,
      viewMode,
      setViewMode,
    ],
  )

  const audio = useMemo(() => {
    // Narration retains cues only. Reuse reader text, or the one-record PDF lookup,
    // when the playing segment has not reached the displayed chapter yet.
    const segment =
      playback.segment === null
        ? null
        : (navigation.currentChapterSegments.find(
            (segment) => segment.id === playback.segment?.id,
          ) ??
          (pdfInput !== undefined &&
          pdfInput.bookId === bookId &&
          pdfInput.contentVersion === contentVersion &&
          pdfInput.segment?.id === playback.segment.id
            ? pdfInput.segment
            : null))
    return {
      ...playback,
      segment,
      isSegmentSplit:
        playback.segment !== null &&
        resolveNarrationPages(
          playback.segment.id,
          navigation.currentChapterSegments,
          measurement,
        ).length > 1,
    }
  }, [
    playback,
    navigation.currentChapterSegments,
    measurement,
    pdfInput,
    bookId,
    contentVersion,
  ])

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
          selectAudioSegment(segmentId)
        },
        reportSegmentError: (report) => {
          dispatch(reportSegmentError(report))
        },
      },
    }),
    [dispatch, bookId, contentVersion, selectAudioSegment],
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
        pdf,
        search,
        audio,
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
      pdf,
      search,
      audio,
      selectedSegmentId,
      highlightedSegmentId,
      actions,
      setCurrentPage,
      requestNavigation,
    ],
  )

  return (
    <ReaderContext value={value}>
      <audio
        ref={audioElementRef}
        hidden
        preload="metadata"
        data-reader-audio
      />
      {typeof children === 'function' ? children(navigation) : children}
    </ReaderContext>
  )
}
