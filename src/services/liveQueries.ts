import { database } from '../data/database'
import { getContentSections } from '../data/contentRepository'
import {
  readChapterSegments,
  readReaderChapterReadiness,
} from '../data/readerChapterRepository'
import { readSavedLibrary } from '../data/libraryRepository'
import { locateChapter } from '../hooks/deriveReaderNavigation'
import { clipPageText, resolveAnchorPage } from '../hooks/resolveAnchorPage'
import type { ReaderScope } from '../models/reader'
import { selectBookDownloadState } from '../store/bookDownloadsSlice'
import {
  getReaderAudioObservation,
  getReaderAudioPlaybackRequest,
} from '../store/readerAudioSlice'
import {
  getReaderAnchor,
  getLayoutKey,
  getReaderScope,
  getReaderViewMode,
  getSelectedSectionId,
  getSelectedSegmentId,
  getAreControlsVisible,
} from '../store/readerSlice'
import { selectPlaybackSpeed } from '../store/playbackSpeedSlice'
import { selectTextSizePercent } from '../store/textSizeSlice'
import type { RootState } from '../store/store'
import {
  livePageTurnerBinding,
  readerPageTurnerBindings,
} from './pageTurnerBindings'

export const appHelp = {
  overview:
    'Voice Archive combines book text, source PDF and synchronized narration. Choose a book in the library. Live can answer current-state questions and end this conversation.',
  reader:
    'Tap text to reveal controls. Use the table of contents, search or page controls to navigate. Text/PDF buttons or a two-finger swipe switch views. Select text for narration; Play opens narration and Pause stops it.',
  live: 'Use the corner Live button to start or stop. Continue resumes an available checkpoint only after you choose it; Discard clears it. Starting narration ends Live once playback starts. You can also ask Live to end the conversation.',
  turner: [livePageTurnerBinding, ...readerPageTurnerBindings]
    .map(({ gesture, action, scope }) => `${gesture}: ${action} (${scope})`)
    .join('. '),
}

export function createLiveQueries(
  getState: () => RootState,
  getPath = () => window.location.pathname,
) {
  return {
    async listAvailableBooks({ offset = 0 }: { offset?: number }) {
      const { books, catalog } = await readSavedLibrary()
      const items = books.slice(offset, offset + 24)
      const nextOffset = offset + items.length
      return {
        items,
        offset,
        cachedCount: books.length,
        total: catalog?.total ?? null,
        complete: catalog?.complete ?? false,
        nextOffset: nextOffset < books.length ? nextOffset : null,
      }
    },
    async getBookInfo({ bookId }: { bookId: number }) {
      const book = await database.books.get(bookId)
      const manifest = (await database.content.get(bookId))?.manifest
      return {
        book: book ?? null,
        contentVersion: manifest?.content_version ?? null,
        contentState: manifest?.state ?? null,
        identitySource: manifest ? 'cache' : 'unavailable',
      }
    },
    async getBookToc({ bookId, contentVersion }: ReaderScope) {
      return database.transaction(
        'r',
        database.content,
        database.sections,
        async () => {
          const content = await database.content.get(bookId)
          if (!content) return { status: 'unavailable' }
          if (content.version !== contentVersion) return { status: 'stale' }
          const sections = await getContentSections(bookId)
          const complete =
            (content.complete ||
              content.progress?.sectionNextOffset === null) &&
            sections.length === content.manifest.section_count
          return {
            status: complete ? 'ready' : 'partial',
            bookId,
            contentVersion,
            sections,
          }
        },
      )
    },
    async getSegments({
      bookId,
      contentVersion,
      segmentIds,
    }: ReaderScope & { segmentIds: number[] }) {
      return database.transaction(
        'r',
        database.content,
        database.segments,
        async () => {
          const content = await database.content.get(bookId)
          if (!content) return { status: 'unavailable' }
          if (content.version !== contentVersion) return { status: 'stale' }
          const segments = await database.segments
            .where('[bookId+version+id]')
            .anyOf(segmentIds.map((id) => [bookId, contentVersion, id]))
            .toArray()
          const missingIds = segmentIds.filter(
            (id) => !segments.some((segment) => segment.id === id),
          )
          return {
            status: missingIds.length ? 'partial' : 'ready',
            bookId,
            contentVersion,
            segments,
            missingIds,
            complete: content.complete,
          }
        },
      )
    },
    async getTextPage({ offset }: { offset: number }): Promise<{
      status: string
      fragments?: ReturnType<typeof clipPageText>
    }> {
      const state = getState()
      const scope = getReaderScope(state)
      const anchor = getReaderAnchor(state)
      const layoutKey = getLayoutKey(state)
      const path = getPath()
      if (!scope || path !== `/books/${scope.bookId}`)
        return { status: 'unavailable' }
      if (!anchor || !layoutKey)
        return {
          status:
            getReaderViewMode(state) === 'pdf' ? 'unavailable' : 'preparing',
        }
      const { bookId, contentVersion } = scope
      const result = await database.transaction(
        'r',
        [
          database.content,
          database.sections,
          database.segments,
          database.measurements,
        ],
        async () => {
          const content = await database.content.get(bookId)
          if (content?.version !== contentVersion) return { status: 'stale' }
          const ready = await readReaderChapterReadiness(
            bookId,
            contentVersion,
            layoutKey,
          )
          const segment = await database.segments
            .where('[bookId+version+id]')
            .equals([bookId, contentVersion, anchor.segmentId])
            .first()
          const chapterId =
            ready &&
            segment &&
            locateChapter(
              segment.sequence,
              ready.chapterIds,
              ready.downloadedChapterRanges,
            )
          if (!ready) return { status: 'preparing' }
          if (!chapterId)
            return {
              status: ready.hasCompleteContent ? 'unavailable' : 'preparing',
            }
          const readChapter = (id: string) =>
            readChapterSegments(bookId, contentVersion, id)
          const segments = await readChapter(chapterId)
          const measurement = ready.measurementsByChapter.get(chapterId)
          const localPage = resolveAnchorPage(
            anchor,
            segments ?? [],
            measurement,
          )
          if (localPage === null)
            return {
              status:
                measurement || getReaderViewMode(state) === 'pdf'
                  ? 'unavailable'
                  : 'preparing',
            }
          // A missing chapter stays a gap, never an apparent book edge or a skipped page.
          const pages = ready.chapterIds.flatMap((id) =>
            ready.availableChapterIds.has(id) &&
            ready.measurementsByChapter.has(id)
              ? ready.measurementsByChapter
                  .get(id)!
                  .pages.map((page) => ({ chapterId: id, page }))
              : [null],
          )
          const index =
            pages.findIndex(
              (item) =>
                item?.chapterId === chapterId &&
                item.page.localPage === localPage,
            ) + offset
          if (index < 0 || index >= pages.length)
            return {
              status:
                index < 0 || ready.hasCompleteContent ? 'edge' : 'preparing',
            }
          const target = pages[index]
          if (!target) return { status: 'preparing' }
          const targetSegments =
            target.chapterId === chapterId
              ? segments
              : await readChapter(target.chapterId)
          const fragments = clipPageText(
            targetSegments ?? [],
            target.page,
            ready.measurementsByChapter.get(target.chapterId)!
              .unmappableSegmentIds,
          )
          return fragments
            ? {
                status: 'ready',
                ...scope,
                layoutKey,
                ...target,
                fragments,
              }
            : { status: 'unavailable' }
        },
      )
      const current = getState()
      return getReaderScope(current) !== scope ||
        getReaderAnchor(current) !== anchor ||
        getLayoutKey(current) !== layoutKey ||
        getPath() !== path
        ? { status: 'stale' }
        : result
    },
    getAppHelp: ({ topic }: { topic: keyof typeof appHelp }) => ({
      topic,
      instructions: appHelp[topic],
    }),
    getAppLocation() {
      const pathname = getPath()
      const match = /^\/books\/([1-9]\d*)$/.exec(pathname)
      const bookId = match ? Number(match[1]) : null
      const scope = getReaderScope(getState())
      return {
        pathname,
        bookId,
        contentVersion: scope?.bookId === bookId ? scope.contentVersion : null,
        reader:
          bookId === null
            ? 'unavailable'
            : scope?.bookId === bookId
              ? 'ready'
              : 'loading',
      }
    },
    getReaderSettings: () => ({
      textSizePercent: selectTextSizePercent(getState()),
      playbackSpeed: selectPlaybackSpeed(getState()),
      areControlsVisible: getReaderScope(getState())
        ? getAreControlsVisible(getState())
        : null,
      viewMode: getReaderViewMode(getState()),
    }),
    getReadingPosition() {
      const state = getState()
      return {
        status: !getReaderScope(state)
          ? 'unavailable'
          : getReaderAnchor(state)
            ? 'ready'
            : 'preparing',
        scope: getReaderScope(state),
        anchor: getReaderAnchor(state),
        selectedSectionId: getSelectedSectionId(state),
        selectedSegmentId: getSelectedSegmentId(state),
      }
    },
    async getBookDownloadState({ bookId }: { bookId: number }) {
      const before = selectBookDownloadState(getState(), bookId)
      const content = await database.content.get(bookId)
      const download = selectBookDownloadState(getState(), bookId)
      if (before !== download) return { bookId, status: 'stale' }
      return {
        bookId,
        status: download?.status ?? 'unavailable',
        contentVersion: download?.manifest?.content_version ?? null,
        sectionStoredCount: download?.sectionStoredCount ?? 0,
        segmentStoredCount: download?.segmentStoredCount ?? 0,
        error: download?.error ?? null,
        committedVersion: content?.version ?? null,
        complete: content?.complete ?? false,
      }
    },
    getNarrationState: () => ({
      requestedPlayback: getReaderAudioPlaybackRequest(getState()),
      observed: getReaderAudioObservation(getState()),
    }),
  }
}
