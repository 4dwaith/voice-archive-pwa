import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { liveQuery } from 'dexie'
import { getSectionFirstSegment } from '../data/contentRepository'
import {
  readChapterSegments,
  readReaderChapterReadiness,
} from '../data/readerChapterRepository'
import { hasNarration } from '../data/readerNarration'
import { findRootSectionAudio } from '../utils/contentHierarchy'
import { getGraphemeBoundaries } from '../components/atoms/ReaderChapterLayout/getGraphemeBoundaries'
import { resolveAnchorPage } from '../hooks/resolveAnchorPage'
import type { ReaderDestination } from './readerCommandsSlice'
import { booksApi } from '../api-client/resources/booksApi'
import { database } from '../data/database'
import { setReaderAudioPlayback } from './readerAudioSlice'
import {
  requestReaderCommand,
  reportReaderCommandError,
  cancelReaderCommands,
  reportCommandRoute,
} from './readerCommandsSlice'
import * as reader from './readerSlice'
import {
  decreaseTextSize,
  increaseTextSize,
  setTextSizePercent,
} from './textSizeSlice'
import { setPlaybackSpeed } from './playbackSpeedSlice'
import type { AppDispatch, RootState } from './store'

async function readCommandTarget(
  destination: ReaderDestination & { contentVersion: string },
  isPlayback: boolean,
) {
  const { bookId, contentVersion } = destination
  return database.transaction(
    'r',
    database.content,
    database.sections,
    database.segments,
    async () => {
      const content = await database.content.get(bookId)
      if (content?.version !== contentVersion)
        throw new Error(
          'The requested book version is unavailable. Download it first.',
        )
      const segment =
        destination.target === 'segment'
          ? await database.segments
              .where('[bookId+version+id]')
              .equals([bookId, contentVersion, destination.segmentId])
              .first()
          : await getSectionFirstSegment(
              bookId,
              contentVersion,
              destination.target === 'section' ? destination.sectionId : 0,
            )
      const offset =
        destination.target === 'segment' ? (destination.offset ?? 0) : 0
      if (
        !segment ||
        (destination.target === 'section' &&
          destination.sectionId === 0 &&
          segment.section_id !== null) ||
        !getGraphemeBoundaries(segment.text_content).some(
          (boundary) => boundary.codePoint === offset,
        )
      )
        throw new Error('The requested destination or offset is unavailable.')
      const chapterId = String(segment.root_section_id ?? 'before')
      const segments = await readChapterSegments(
        bookId,
        contentVersion,
        chapterId,
      )
      if (!segments)
        throw new Error(
          'The target chapter is not cached completely. Finish its download first.',
        )
      if (isPlayback) {
        const narrated = segments.find(
          (candidate) =>
            candidate.sequence >= segment.sequence && hasNarration(candidate),
        )
        const sections = await database.sections
          .where('[bookId+version]')
          .equals([bookId, contentVersion])
          .toArray()
        if (!narrated || !findRootSectionAudio(narrated, sections, content))
          throw new Error(
            'Narration is unavailable in the cached target chapter.',
          )
      }
      return {
        chapterId,
        segments,
        anchor: { segmentId: segment.id, offset },
        sectionId:
          destination.target === 'section'
            ? destination.sectionId
            : (segment.section_id ?? segment.root_section_id ?? 0),
      }
    },
  )
}

export function createReaderCommandsListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  let revision = 0
  let navigateToPath: ((path: string) => void) | null = null
  let ownsDispatch = false
  let routeTarget: ReaderDestination | null = null
  let routeOrigin: ReturnType<typeof reader.getReaderScope> = null
  let expectedPath: string | null = null
  let cancelPending = () => {}
  listener.startListening({
    matcher: isAnyOf(
      requestReaderCommand,
      cancelReaderCommands,
      reportCommandRoute,
      setReaderAudioPlayback,
      reader.closeReader,
      reader.openReader,
      reader.selectSegment,
      reader.selectSection,
      reader.setReaderAnchor,
      reader.setReaderViewMode,
      reader.requestPageNavigation,
      decreaseTextSize,
      increaseTextSize,
      setTextSizePercent,
    ),
    effect: (action, api) => {
      if (ownsDispatch) return
      if (reportCommandRoute.match(action) && action.payload === expectedPath) {
        expectedPath = null
        return
      }
      // Owned routing includes React's scope mount/unmount cycle.
      if (
        routeTarget &&
        (reader.openReader.match(action) || reader.closeReader.match(action)) &&
        [routeOrigin, routeTarget].some(
          (scope) =>
            scope?.bookId === action.payload.bookId &&
            scope.contentVersion === action.payload.contentVersion,
        )
      )
        return
      revision++
      cancelPending()
      routeTarget = null
      expectedPath = null
      api.dispatch(reader.cancelTextPageMove())
    },
  })
  listener.startListening({
    actionCreator: requestReaderCommand,
    async effect({ payload: command }, api) {
      const capturedRevision = revision
      const isCurrent = () => capturedRevision === revision
      const scope = reader.getReaderScope(api.getState())
      cancelPending = api.cancel
      function dispatchOwned(action: Parameters<AppDispatch>[0]) {
        ownsDispatch = true
        try {
          api.dispatch(action)
        } finally {
          ownsDispatch = false
        }
      }
      try {
        switch (command.kind) {
          case 'goHome':
            if (!navigateToPath)
              throw new Error('Home navigation is unavailable.')
            navigateToPath('/')
            break
          case 'openBook': {
            if (!navigateToPath)
              throw new Error('Book navigation is unavailable.')
            const [book, content] = await Promise.all([
              database.books.get(command.bookId),
              database.content.get(command.bookId),
            ])
            if (!isCurrent()) return
            if (!book && !content)
              throw new Error(
                'Choose a known book from the library before opening it.',
              )
            if (
              command.contentVersion !== undefined &&
              content?.version !== command.contentVersion
            )
              throw new Error(
                'The requested cached book version is unavailable.',
              )
            if (scope)
              dispatchOwned(
                setReaderAudioPlayback({ ...scope, isPlaying: false }),
              )
            navigateToPath(`/books/${command.bookId}`)
            break
          }
          case 'refreshLibrary': {
            const refresh = api.dispatch(
              booksApi.endpoints.libraryBooks.initiate(undefined, {
                forceRefetch: true,
              }),
            )
            try {
              await refresh.unwrap()
            } catch {
              throw new Error(
                'The library could not be refreshed. Please try again.',
              )
            } finally {
              refresh.unsubscribe()
            }
            break
          }
          case 'updateReaderSettings': {
            if (command.textSize !== undefined) {
              api.dispatch(setTextSizePercent(command.textSize))
            }
            if (command.playbackSpeed !== undefined) {
              api.dispatch(setPlaybackSpeed(command.playbackSpeed))
            }
            if (command.controlsVisible !== undefined) {
              if (!scope)
                throw new Error('Open a book before toggling its controls.')
              api.dispatch(reader.setControlsVisible(command.controlsVisible))
            }
            if (command.viewMode !== undefined) {
              if (!scope)
                throw new Error('Open a book before changing its view.')
              const content = await database.content.get(scope.bookId)
              if (!isCurrent()) return
              if (
                content?.version !== scope.contentVersion ||
                (command.viewMode === 'pdf' &&
                  !content.manifest.files.some(
                    (file) =>
                      file.kind === 'source_pdf' &&
                      file.id === content.manifest.source_pdf_file_id,
                  ))
              )
                throw new Error('This book has no available matching view.')
              api.dispatch(reader.setReaderViewMode(command.viewMode))
            }
            break
          }
          case 'selectSegment': {
            if (scope?.bookId !== command.bookId)
              throw new Error('The requested book version is not open.')
            const contentVersion =
              command.contentVersion ?? scope.contentVersion
            if (scope.contentVersion !== contentVersion)
              throw new Error('The requested book version is not open.')
            const content = await database.content.get(command.bookId)
            const segment =
              command.segmentId === null ||
              (await database.segments
                .where('[bookId+version+id]')
                .equals([command.bookId, contentVersion, command.segmentId])
                .first())
            if (!isCurrent()) return
            if (content?.version !== contentVersion || !segment)
              throw new Error(
                'The requested segment is unavailable in this book version.',
              )
            api.dispatch(reader.selectSegment(command.segmentId))
            break
          }
          case 'navigateToSection':
          case 'navigateToSegment':
          case 'startPlayback': {
            const rawDestination =
              command.kind === 'startPlayback'
                ? command.destination
                : command.kind === 'navigateToSection'
                  ? { ...command, target: 'section' as const }
                  : { ...command, target: 'segment' as const }
            const { bookId } = rawDestination
            let contentVersion = rawDestination.contentVersion
            if (!contentVersion) {
              if (scope?.bookId === bookId) {
                contentVersion = scope.contentVersion
              } else {
                const content = await database.content.get(bookId)
                if (!content)
                  throw new Error(
                    'The requested book version is unavailable. Download it first.',
                  )
                contentVersion = content.version
              }
            }
            const destination: ReaderDestination & { contentVersion: string } =
              {
                ...rawDestination,
                contentVersion,
              }
            const isSameScope = () => {
              const active = reader.getReaderScope(api.getState())
              return (
                active?.bookId === bookId &&
                active.contentVersion === contentVersion
              )
            }
            const currentAnchor = reader.getReaderAnchor(api.getState())
            if (
              command.kind === 'startPlayback' &&
              destination.target === 'current' &&
              (!isSameScope() ||
                reader.getReaderViewMode(api.getState()) !== 'text' ||
                !currentAnchor)
            )
              throw new Error(
                'Open the matching Text position before reading aloud.',
              )
            const resolved =
              destination.target === 'current' &&
              command.kind === 'startPlayback'
                ? {
                    ...destination,
                    target: 'segment' as const,
                    ...currentAnchor!,
                  }
                : destination
            const target = await readCommandTarget(
              resolved,
              command.kind === 'startPlayback',
            )
            if (!isCurrent()) return
            if (scope)
              dispatchOwned(
                setReaderAudioPlayback({ ...scope, isPlaying: false }),
              )
            if (!isSameScope()) {
              if (!navigateToPath)
                throw new Error('Book navigation is unavailable.')
              routeTarget = destination
              routeOrigin = scope
              expectedPath = `/books/${bookId}`
              navigateToPath(expectedPath)
            }
            dispatchOwned(reader.setReaderViewMode('text'))
            const hasEntryLayout = () =>
              isSameScope() && reader.getLayoutKey(api.getState()) !== null
            if (
              !hasEntryLayout() &&
              !(await api.condition(
                () => !isCurrent() || hasEntryLayout(),
                15000,
              ))
            )
              throw new Error(
                'The book Text layout is still preparing. Please retry.',
              )
            if (!isCurrent()) return
            const layoutKey = reader.getLayoutKey(api.getState())!
            let subscription: { unsubscribe(): void } | undefined
            try {
              const committed = new Promise<void>((resolve, reject) => {
                subscription = liveQuery(async () => {
                  const ready = await readReaderChapterReadiness(
                    bookId,
                    contentVersion,
                    layoutKey,
                  )
                  if (!ready)
                    throw new Error('The target book changed while opening it.')
                  const measurement = ready.measurementsByChapter.get(
                    target.chapterId,
                  )
                  if (!measurement) return false
                  if (
                    !resolveAnchorPage(
                      target.anchor,
                      target.segments,
                      measurement,
                    )
                  )
                    throw new Error(
                      'The target cannot be shown in Text layout.',
                    )
                  return true
                }).subscribe({
                  next: (ready) => {
                    if (ready) resolve()
                  },
                  error: reject,
                })
              })
              const timeout = api.delay(15000).then(() => {
                throw new Error(
                  'The target layout is still preparing. Please retry.',
                )
              })
              await api.pause(Promise.race([committed, timeout]))
            } finally {
              subscription?.unsubscribe()
            }
            if (!isCurrent()) return
            if (
              !isSameScope() ||
              reader.getLayoutKey(api.getState()) !== layoutKey
            )
              throw new Error('The target layout changed. Please retry.')
            routeTarget = null
            dispatchOwned(
              reader.setReaderAnchor({
                bookId,
                contentVersion,
                anchor: target.anchor,
                sectionId: target.sectionId,
              }),
            )
            if (command.kind === 'navigateToSection')
              dispatchOwned(reader.selectSection(target.sectionId))
            if (
              command.kind === 'navigateToSegment' ||
              command.kind === 'startPlayback'
            )
              dispatchOwned(reader.selectSegment(target.anchor.segmentId))
            if (command.kind === 'startPlayback')
              dispatchOwned(
                setReaderAudioPlayback({
                  bookId,
                  contentVersion,
                  isPlaying: true,
                  segmentId: target.anchor.segmentId,
                }),
              )
            break
          }
          case 'moveTextPage':
            if (!scope || reader.getReaderViewMode(api.getState()) !== 'text')
              throw new Error('Open Text view before moving a Text page.')
            api.dispatch(
              reader.requestTextPageMove(command.direction === 'next' ? 1 : -1),
            )
        }
      } catch (error) {
        if (isCurrent())
          api.dispatch(
            reportReaderCommandError({
              requestId: command.requestId,
              message:
                error instanceof Error
                  ? error.message
                  : 'The command could not be completed.',
            }),
          )
      } finally {
        if (isCurrent()) {
          cancelPending = () => {}
          routeTarget = null
          expectedPath = null
        }
      }
    },
  })
  return Object.assign(listener, {
    registerNavigation(callback: (path: string) => void) {
      navigateToPath = callback
      return () => {
        if (navigateToPath === callback) {
          navigateToPath = null
          revision++
          cancelPending()
        }
      }
    },
  })
}
