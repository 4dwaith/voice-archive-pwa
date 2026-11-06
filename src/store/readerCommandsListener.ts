import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { booksApi } from '../api-client/resources/booksApi'
import { database } from '../data/database'
import { setReaderAudioPlayback } from './readerAudioSlice'
import { requestBookLoad } from './bookDownloadsSlice'
import {
  requestReaderCommand,
  reportReaderCommandError,
  cancelReaderCommands,
} from './readerCommandsSlice'
import * as reader from './readerSlice'
import {
  decreaseTextSize,
  increaseTextSize,
  setTextSizePercent,
} from './textSizeSlice'
import type { AppDispatch, RootState } from './store'

export function createReaderCommandsListener() {
  const listener = createListenerMiddleware<RootState, AppDispatch>()
  let revision = 0
  let navigateHome: (() => void) | null = null
  listener.startListening({
    matcher: isAnyOf(
      requestReaderCommand,
      cancelReaderCommands,
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
    effect: (_, api) => {
      revision++
      api.dispatch(reader.cancelTextPageMove())
    },
  })
  listener.startListening({
    actionCreator: requestReaderCommand,
    async effect({ payload: command }, api) {
      const capturedRevision = revision
      const isCurrent = () => capturedRevision === revision
      const scope = reader.getReaderScope(api.getState())
      try {
        switch (command.kind) {
          case 'goHome':
            if (!navigateHome)
              throw new Error('Home navigation is unavailable.')
            navigateHome()
            break
          case 'downloadBook':
            api.dispatch(requestBookLoad(command.bookId))
            break
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
          case 'setTextSize':
            api.dispatch(setTextSizePercent(command.percent))
            break
          case 'setViewMode': {
            if (!scope) throw new Error('Open a book before changing its view.')
            const content = await database.content.get(scope.bookId)
            if (!isCurrent()) return
            if (
              content?.version !== scope.contentVersion ||
              (command.mode === 'pdf' &&
                !content.manifest.files.some(
                  (file) =>
                    file.kind === 'source_pdf' &&
                    file.id === content.manifest.source_pdf_file_id,
                ))
            )
              throw new Error('This book has no available matching view.')
            api.dispatch(reader.setReaderViewMode(command.mode))
            break
          }
          case 'selectSegment': {
            if (
              scope?.bookId !== command.bookId ||
              scope.contentVersion !== command.contentVersion
            )
              throw new Error('The requested book version is not open.')
            const content = await database.content.get(command.bookId)
            const segment =
              command.segmentId === null ||
              (await database.segments
                .where('[bookId+version+id]')
                .equals([
                  command.bookId,
                  command.contentVersion,
                  command.segmentId,
                ])
                .first())
            if (!isCurrent()) return
            if (content?.version !== command.contentVersion || !segment)
              throw new Error(
                'The requested segment is unavailable in this book version.',
              )
            api.dispatch(reader.selectSegment(command.segmentId))
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
      }
    },
  })
  return Object.assign(listener, {
    registerNavigation(callback: () => void) {
      navigateHome = callback
      return () => {
        if (navigateHome === callback) {
          navigateHome = null
          revision++
        }
      }
    },
  })
}
