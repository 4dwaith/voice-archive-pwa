import { database } from '../data/database'
import { selectBookDownloadState } from '../store/bookDownloadsSlice'
import {
  getReaderAudioObservation,
  getReaderAudioPlaybackRequest,
} from '../store/readerAudioSlice'
import {
  getReaderAnchor,
  getReaderScope,
  getReaderViewMode,
  getSelectedSectionId,
  getSelectedSegmentId,
} from '../store/readerSlice'
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
