// Enabled only by the E2E launcher, never by a normal build.
import { store } from '../store/store'
import {
  requestBookLoad,
  requestBookRemoval,
} from '../store/bookDownloadsSlice'
import { database } from '../data/database'
import { getContentSections } from '../data/contentRepository'

function dispatchAndWaitForBookRequest(
  action:
    ReturnType<typeof requestBookLoad> | ReturnType<typeof requestBookRemoval>,
) {
  return new Promise<
    NonNullable<
      ReturnType<typeof store.getState>['bookDownloads']['byBook'][number]
    >
  >((resolve, reject) => {
    const unsubscribe = store.subscribe(() => {
      const download =
        store.getState().bookDownloads.byBook[action.payload.bookId]
      if (
        !download ||
        download.activeRequestId ||
        download.status === 'loading' ||
        download.status === 'partial' ||
        download.status === 'removing'
      )
        return
      unsubscribe()
      if (download.status === 'error') reject(new Error(download.error!))
      else resolve(download)
    })
    store.dispatch(action)
  })
}

export const contentTestHarness = {
  open(bookId: number) {
    return dispatchAndWaitForBookRequest(requestBookLoad(bookId))
  },
  remove(bookId: number) {
    return dispatchAndWaitForBookRequest(requestBookRemoval(bookId))
  },
  waitForCompletion(bookId: number) {
    // Observe the current request without dispatching another load or retry.
    return new Promise<void>((resolve) => {
      function checkCompletion() {
        const downloadState = store.getState().bookDownloads.byBook[bookId]

        if (!downloadState || downloadState.activeRequestId) return
        if (['loading', 'partial', 'removing'].includes(downloadState.status))
          return

        unsubscribe()
        resolve()
      }

      const unsubscribe = store.subscribe(checkCompletion)
      checkCompletion()
    })
  },
  async countStoredRows(bookId: number) {
    // Count all versions directly, including orphan rows with no manifest.
    return {
      sections: await database.sections.where('bookId').equals(bookId).count(),
      segments: await database.segments.where('bookId').equals(bookId).count(),
    }
  },
  async read(bookId: number) {
    const content = await database.content.get(bookId)
    // Full arrays are for tiny browser fixtures only; no production reader is added here.
    const segments = content
      ? await database.segments
          .where('[bookId+version]')
          .equals([bookId, content.version])
          .sortBy('sequence')
      : []
    return {
      content,
      sections: await getContentSections(bookId),
      segments,
      readable: segments,
    }
  },
}

export function installContentTestHarness() {
  Object.assign(window, { contentTestHarness })
}
