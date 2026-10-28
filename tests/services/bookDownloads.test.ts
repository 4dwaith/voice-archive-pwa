import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAppStore, type AppStore } from '../../src/store/store'
import {
  selectBookDownloadState,
  requestBookLoad,
  requestBookRetry,
  requestBookClose,
  requestBookRemoval,
  type BookDownloadStatus,
} from '../../src/store/bookDownloadsSlice'
import { archiveApi } from '../../src/api-client/archiveApi'
import { apiBaseUrl } from '../../src/api-client/baseApi'
import { database } from '../../src/data/database'
import { getContentApiPaths } from '../helpers/contentApiPaths'
import type {
  ContentManifestOutput,
  SectionReadOutput,
  SegmentReadOutput,
} from '../../src/api-client/generated/schemas'

const version = 'a3027b66-924c-4c9a-aad5-660ba7a733bc'
const nextVersion = '1ac04088-bfcb-44e0-bcdf-ff025c93dcac'

// A parent-before-child hierarchy whose IDs deliberately differ from reading order.
const sections: SectionReadOutput[] = [
  {
    id: 10,
    source_key: 'root',
    sequence: 0,
    parent_id: null,
    kind: 'chapter',
    title: 'Root',
    sibling_sequence: 0,
    audio_file_id: null,
    first_segment_source_key: 'a',
  },
  {
    id: 2,
    source_key: 'child',
    sequence: 5,
    parent_id: 10,
    kind: 'section',
    title: 'Child',
    sibling_sequence: 0,
    audio_file_id: null,
    first_segment_source_key: 'a',
  },
]

// Both segments belong to the nested section. Sequence gaps ensure pagination
// uses row offsets rather than treating a sequence value as an array index.
const segments: SegmentReadOutput[] = ['a', 'b'].map((source_key, index) => ({
  id: index + 1,
  source_key,
  section_id: 2,
  sequence: index * 3,
  kind: 'prose',
  html_content: '<p><em>ಕನ್ನಡ</em><br>text</p>',
  text_content: 'ಕನ್ನಡ\ntext',
  language: 'kn',
  regions: [],
  page_indexes: [],
  narration_start_ms: null,
  narration_end_ms: null,
  narration_seek_ms: null,
  alignment_status: null,
  alignment_metadata: null,
}))

// The fake server normally publishes two sections and two text segments, no media.
const published: ContentManifestOutput = {
  state: 'published',
  content_version: version,
  schema_version: 1,
  imported_at: '2026-10-24T00:00:00Z',
  source_pdf_file_id: null,
  section_count: 2,
  segment_count: 2,
  files: [],
}

const empty: ContentManifestOutput = {
  ...published,
  state: 'empty',
  content_version: null,
  schema_version: null,
  imported_at: null,
  section_count: 0,
  segment_count: 0,
}

let store: AppStore
let serverManifest: ContentManifestOutput
let httpRequests: Request[]
let respondToRequest: (request: Request) => Response | Promise<Response>

// Let an individual test release an HTTP response or database write explicitly.
// This controls ordering without sleeps or assumptions about machine speed.
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

// Both books use the same small content fixture. Derive their concrete paths
// from generated request builders, including substitution of each book ID.
function isContentRequest(
  request: Request,
  endpoint: 'manifest' | 'sections' | 'segments',
) {
  const pathname = new URL(request.url).pathname
  return [7, 8].some(
    (bookId) => pathname === getContentApiPaths(bookId, version)[endpoint],
  )
}

// This is only the HTTP boundary. Redux reducers/listeners, RTK response schemas,
// and Dexie operations remain real. Tests override selected responses below.
function respondWithBookFixture(request: Request): Response {
  const url = new URL(request.url)

  // Reading the manifest has no version precondition; it announces server state.
  if (isContentRequest(request, 'manifest'))
    return Response.json(serverManifest)

  // Collection reads must pin the version announced by the current manifest.
  expect(request.headers.get('If-Content-Version')).toBe(
    serverManifest.content_version,
  )

  // Sections fit on one page. Their preorder is the fixture's array order.
  if (isContentRequest(request, 'sections')) {
    expect(url.searchParams.get('offset')).toBe('0')
    expect(url.searchParams.get('limit')).toBe('2000')

    return Response.json({
      content_version: serverManifest.content_version,
      items: sections,
      next_offset: null,
    })
  }

  // Return one segment per page even though the client permits 500. This exercises
  // following next_offset: offsets 0/1 select reading sequences 0/3 respectively.
  if (isContentRequest(request, 'segments')) {
    expect(url.searchParams.get('limit')).toBe('500')
    const offset = Number(url.searchParams.get('offset'))

    return Response.json({
      content_version: serverManifest.content_version,
      items: [segments[offset]],
      next_offset: offset === 0 ? 1 : null,
    })
  }

  throw new Error(`Unexpected HTTP request: ${request.url}`)
}

function getDownloadState(bookId = 7) {
  return selectBookDownloadState(store.getState(), bookId)
}

// A terminal status alone is insufficient: cleanup must also release the active ID.
async function waitForDownload(status: BookDownloadStatus, bookId = 7) {
  await vi.waitFor(() => {
    expect(getDownloadState(bookId)?.status).toBe(status)
    expect(getDownloadState(bookId)?.activeRequestId).toBeNull()
  })
  return getDownloadState(bookId)!
}

async function loadBook(bookId = 7) {
  store.dispatch(requestBookLoad(bookId))
  return waitForDownload('ready', bookId)
}

// Every case starts with empty IndexedDB and an independent real application store.
beforeEach(async () => {
  await database.delete()
  await database.open()

  store = createAppStore()
  serverManifest = structuredClone(published)
  httpRequests = []
  respondToRequest = respondWithBookFixture

  // Capture the Request objects constructed by RTK Query, not calls to a fake transport.
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      httpRequests.push(request)
      return Promise.resolve(respondToRequest(request))
    }),
  )
})

// Stop effects before deleting their storage, so a late writer cannot leak into
// the next case. Reset RTK state as well as IndexedDB.
afterEach(async () => {
  for (const bookId of Object.keys(store.getState().bookDownloads.byBook)) {
    store.dispatch(requestBookClose(Number(bookId)))
  }

  await vi.waitFor(() =>
    expect(
      Object.values(store.getState().bookDownloads.byBook).every(
        (entry) => !entry?.activeRequestId,
      ),
    ).toBe(true),
  )

  store.dispatch(archiveApi.util.resetApiState())
  await database.delete()
})

it('stores the complete book projection and committed Redux progress', async () => {
  // Download the default fixture through real RTK endpoints and listener side effects.
  const downloadState = await loadBook()

  // Redux counts describe committed rows, and Dexie marks the dataset complete.
  expect(downloadState).toMatchObject({
    sectionStoredCount: 2,
    segmentStoredCount: 2,
    sectionsComplete: true,
    lastSegmentSequence: 3,
  })
  expect((await database.content.get(7))?.complete).toBe(true)

  // Both child-owned segments must retain reading order and resolve to root 10.
  const rows = await database.segments
    .orderBy('[bookId+version+sequence]')
    .toArray()

  expect(rows.map((row) => [row.sequence, row.root_section_id])).toEqual([
    [0, 10],
    [3, 10],
  ])

  // Caching must preserve the canonical formatting and derived Unicode text.
  expect(rows[0].html_content).toBe(segments[0].html_content)
  expect(rows[0].text_content).toBe(segments[0].text_content)
})

it('checks the manifest without redownloading a complete matching cache', async () => {
  // Establish a completed cache, then observe only the requests from the next open.
  await loadBook()
  const initialRequestCount = httpRequests.length

  await loadBook()

  expect(
    httpRequests
      .slice(initialRequestCount)
      .map((request) => new URL(request.url).pathname),
  ).toEqual([getContentApiPaths(7, version).manifest])
})

it('starts the first segment request before the section response finishes', async () => {
  // Hold sections open. The first segment response is immediate, but its write
  // must wait for section ownership to be available.
  const sectionResponse = createDeferred<Response>()

  respondToRequest = (request) =>
    isContentRequest(request, 'sections')
      ? sectionResponse.promise
      : respondWithBookFixture(request)

  store.dispatch(requestBookLoad(7))

  try {
    await vi.waitFor(() => {
      expect(
        httpRequests.some((request) => isContentRequest(request, 'sections')),
      ).toBe(true)
      expect(
        httpRequests.some((request) => isContentRequest(request, 'segments')),
      ).toBe(true)
    })

    expect(await database.segments.count()).toBe(0)
  } finally {
    // Release the deliberately pending response even if an assertion fails.
    sectionResponse.resolve(
      Response.json({
        content_version: version,
        items: sections,
        next_offset: null,
      }),
    )
  }

  await waitForDownload('ready')
})

it('coalesces duplicate load intents into one download', async () => {
  // Keep the first manifest request pending so the duplicate is definitely issued
  // during the same load, rather than becoming a legitimate later manifest check.
  const manifestResponse = createDeferred<Response>()
  let isFirstManifest = true

  respondToRequest = (request) => {
    if (isContentRequest(request, 'manifest') && isFirstManifest) {
      isFirstManifest = false
      return manifestResponse.promise
    }

    return respondWithBookFixture(request)
  }

  store.dispatch(requestBookLoad(7))
  await vi.waitFor(() => expect(httpRequests).toHaveLength(1))
  const acceptedRequestId = getDownloadState()?.requestId

  try {
    store.dispatch(requestBookLoad(7))

    expect(getDownloadState()?.requestId).toBe(acceptedRequestId)
    expect(httpRequests).toHaveLength(1)
  } finally {
    manifestResponse.resolve(Response.json(serverManifest))
  }

  await waitForDownload('ready')

  // One initial manifest + one final check, one section page, and two segment pages.
  expect(
    httpRequests.filter((request) => isContentRequest(request, 'manifest')),
  ).toHaveLength(2)
  expect(
    httpRequests.filter((request) => isContentRequest(request, 'sections')),
  ).toHaveLength(1)
  expect(
    httpRequests.filter((request) => isContentRequest(request, 'segments')),
  ).toHaveLength(2)
})

it('exposes a committed first batch while the remaining segments are downloading', async () => {
  // Sections and the first segment arrive normally; only the second segment waits.
  const secondResponse = createDeferred<Response>()

  respondToRequest = (request) => {
    const url = new URL(request.url)
    if (
      isContentRequest(request, 'segments') &&
      url.searchParams.get('offset') === '1'
    ) {
      return secondResponse.promise
    }

    return respondWithBookFixture(request)
  }

  store.dispatch(requestBookLoad(7))

  try {
    await vi.waitFor(() => expect(getDownloadState()?.status).toBe('partial'))

    // Partial availability describes actual stored text, not an unfinished write.
    expect(getDownloadState()?.segmentStoredCount).toBe(1)
    expect((await database.content.get(7))?.complete).toBe(false)
    expect(
      (await database.segments.toArray()).map((row) => row.source_key),
    ).toEqual(['a'])
  } finally {
    secondResponse.resolve(
      Response.json({
        content_version: version,
        items: [segments[1]],
        next_offset: null,
      }),
    )
  }

  await waitForDownload('ready')
  expect(await database.segments.count()).toBe(2)
})

it('does not publish a segment batch before its database write commits', async () => {
  // Delay just the first bulkAdd. Releasing the gate performs the real Dexie write.
  const releaseWrite = createDeferred<void>()
  const write = database.segments.bulkAdd.bind(database.segments)
  const pendingWrite = vi
    .spyOn(database.segments, 'bulkAdd')
    .mockImplementationOnce((rows) =>
      Dexie.Promise.resolve(Dexie.waitFor(releaseWrite.promise)).then(() =>
        write(rows),
      ),
    )

  store.dispatch(requestBookLoad(7))

  try {
    await vi.waitFor(() => expect(pendingWrite).toHaveBeenCalledTimes(1))

    // The HTTP response exists, but neither storage nor Redux can report it yet.
    expect(getDownloadState()?.status).toBe('loading')
    expect(getDownloadState()?.segmentStoredCount).toBe(0)
    // An external read would wait for this deliberately held transaction.
  } finally {
    releaseWrite.resolve()
  }

  await waitForDownload('ready')
})

it('uses the completed cache when the manifest request has a network failure', async () => {
  await loadBook()

  // Rejecting fetch represents a transport failure, not an HTTP error response.
  respondToRequest = () => {
    throw new TypeError('Network unavailable')
  }

  store.dispatch(requestBookLoad(7))
  const downloadState = await waitForDownload('offline')

  expect(downloadState.segmentStoredCount).toBe(2)
  expect((await database.content.get(7))?.complete).toBe(true)
})

it('preserves the complete cache but reports an error for a malformed manifest', async () => {
  await loadBook()

  // HTTP succeeds, but the real generated response schema rejects this body.
  respondToRequest = () => Response.json({ bad: true })

  store.dispatch(requestBookLoad(7))
  await waitForDownload('error')

  expect((await database.content.get(7))?.complete).toBe(true)
})

it('clears an old version and saved position and downloads the replacement in the same request', async () => {
  // Establish old content and a logical position tied to that publication.
  await loadBook()
  await database.contentPositions.put({
    bookId: 7,
    version,
    sourceKey: 'a',
    offset: 1,
  })

  // Only the server version changes; the next open must replace the local projection.
  serverManifest = { ...serverManifest, content_version: nextVersion }

  await loadBook()

  // The new cache must contain no old-version rows or old logical position.
  expect((await database.content.get(7))?.version).toBe(nextVersion)
  expect(await database.contentPositions.get(7)).toBeUndefined()
  expect(await database.segments.count()).toBe(2)
  expect(
    (await database.segments.toArray()).every(
      (row) => row.version === nextVersion,
    ),
  ).toBe(true)
})

it('refetches the current publication after a 412 during segment download', async () => {
  // The first segment request encounters a purge/reimport. All later responses
  // describe the replacement, so the retry must obtain a fresh manifest/version.
  let hasReturnedVersionFailure = false

  respondToRequest = (request) => {
    if (isContentRequest(request, 'segments') && !hasReturnedVersionFailure) {
      hasReturnedVersionFailure = true
      serverManifest = { ...serverManifest, content_version: nextVersion }

      return Response.json(
        { error: { code: 'content_version_mismatch', message: 'Changed' } },
        { status: 412 },
      )
    }

    return respondWithBookFixture(request)
  }

  await loadBook()

  expect((await database.content.get(7))?.version).toBe(nextVersion)
  expect(await database.segments.count()).toBe(2)
})

it('refetches when a segment page carries a different version', async () => {
  // Simulate an inconsistent successful response instead of an HTTP 412. The sync
  // layer must reject that page rather than combine it with the requested version.
  let hasReturnedChangedPage = false

  respondToRequest = (request) => {
    if (isContentRequest(request, 'segments') && !hasReturnedChangedPage) {
      hasReturnedChangedPage = true
      serverManifest = { ...serverManifest, content_version: nextVersion }

      return Response.json({
        content_version: nextVersion,
        items: [segments[0]],
        next_offset: 1,
      })
    }

    return respondWithBookFixture(request)
  }

  await loadBook()

  expect((await database.content.get(7))?.version).toBe(nextVersion)
  expect(await database.segments.count()).toBe(2)
})

it('refetches if publication changes at the final manifest check', async () => {
  // The first download's pages are consistent. Change publication only when the
  // client checks the manifest again before declaring that download complete.
  let manifestReadCount = 0

  respondToRequest = (request) => {
    if (isContentRequest(request, 'manifest')) {
      manifestReadCount++
      if (manifestReadCount === 2)
        serverManifest = { ...serverManifest, content_version: nextVersion }
    }

    return respondWithBookFixture(request)
  }

  await loadBook()

  expect((await database.content.get(7))?.version).toBe(nextVersion)
  expect(await database.segments.count()).toBe(2)
})

it('bounds retries if the publication keeps changing', async () => {
  // Alternate versions at every manifest read. Each initial read is contradicted
  // by its final check, forcing the client to exhaust the three-attempt limit.
  let reads = 0

  respondToRequest = (request) => {
    if (isContentRequest(request, 'manifest')) {
      reads++
      serverManifest = {
        ...serverManifest,
        content_version: reads % 2 ? version : nextVersion,
      }
    }
    return respondWithBookFixture(request)
  }

  store.dispatch(requestBookLoad(7))
  await waitForDownload('error')

  // Three attempts, each with an initial and final manifest request.
  expect(reads).toBe(6)
  expect(await database.content.count()).toBe(0)
})

it.each(['empty', 'pdf_only'] as const)(
  'keeps a %s book open as no-text and removes old content',
  async (state) => {
    // Start with old cached text and a saved position, then withdraw publication.
    await loadBook()
    await database.contentPositions.put({
      bookId: 7,
      version,
      sourceKey: 'a',
      offset: 1,
    })

    serverManifest = { ...empty, state }

    store.dispatch(requestBookLoad(7))
    const downloadState = await waitForDownload('empty')

    // Redux describes no text; every old structured record/position is gone.
    expect(downloadState.manifest?.state).toBe(state)
    expect(downloadState.segmentStoredCount).toBe(0)
    expect(await database.content.count()).toBe(0)
    expect(await database.sections.count()).toBe(0)
    expect(await database.segments.count()).toBe(0)
    expect(await database.contentPositions.count()).toBe(0)
  },
)

it('handles purge at the final manifest check as an empty book without retaining staging', async () => {
  // All text pages arrive normally, but publication is purged before completion.
  let reads = 0

  respondToRequest = (request) => {
    if (isContentRequest(request, 'manifest') && ++reads === 2)
      serverManifest = empty

    return respondWithBookFixture(request)
  }

  store.dispatch(requestBookLoad(7))
  await waitForDownload('empty')

  expect(await database.content.count()).toBe(0)
  expect(await database.segments.count()).toBe(0)
})

it('distinguishes a deleted book from a book without text and clears its old cache', async () => {
  await loadBook()

  // This is a real HTTP 404 envelope, not an empty manifest or network failure.
  respondToRequest = () =>
    Response.json(
      { error: { code: 'book_not_found', message: 'Missing' } },
      { status: 404 },
    )

  store.dispatch(requestBookLoad(7))
  const downloadState = await waitForDownload('error')

  expect(downloadState.error).toContain('no longer available')
  expect(await database.content.count()).toBe(0)
})

it.each(['sections', 'segments'] as const)(
  'retains valid checkpoints after a truncated %s response and can retry',
  async (resource) => {
    // Only the selected collection ends early. The manifest still promises two rows.
    respondToRequest = (request) =>
      isContentRequest(request, resource)
        ? Response.json({
            content_version: version,
            items: [],
            next_offset: null,
          })
        : respondWithBookFixture(request)

    store.dispatch(requestBookLoad(7))
    await waitForDownload('error')

    // The invalid batch never commits or advances that stream's checkpoint.
    const cached = await database.content.get(7)
    expect(cached?.complete).toBe(false)
    expect(
      resource === 'sections'
        ? cached?.progress?.sectionNextOffset
        : cached?.progress?.segmentNextOffset,
    ).toBe(0)
    expect(await database.segments.count()).toBe(0)

    // Restore normal HTTP responses; the retry still enters through the real action.
    respondToRequest = respondWithBookFixture
    store.dispatch(requestBookRetry(7))
    await waitForDownload('ready')
  },
)

it.each(['sections', 'segments'] as const)(
  'rejects a non-advancing %s offset',
  async (resource) => {
    // A non-final response points to offset zero again. The client must stop
    // rather than loop forever or store the same rows repeatedly.
    respondToRequest = (request) =>
      isContentRequest(request, resource)
        ? Response.json({
            content_version: version,
            items: resource === 'sections' ? sections : segments,
            next_offset: 0,
          })
        : respondWithBookFixture(request)

    store.dispatch(requestBookLoad(7))
    await waitForDownload('error')

    const cached = await database.content.get(7)
    expect(cached?.complete).toBe(false)
    expect(
      resource === 'sections'
        ? cached?.progress?.sectionNextOffset
        : cached?.progress?.segmentNextOffset,
    ).toBe(0)
  },
)

it('retains sections and the unwritten segment offset after quota failure', async () => {
  // HTTP remains healthy. Reject only the first segment write as storage exhaustion.
  vi.spyOn(database.segments, 'bulkAdd').mockRejectedValueOnce(
    new DOMException('Full', 'QuotaExceededError'),
  )

  store.dispatch(requestBookLoad(7))
  await waitForDownload('error')

  expect(await database.sections.count()).toBe(2)
  expect(await database.segments.count()).toBe(0)
  expect((await database.content.get(7))?.progress).toEqual({
    sectionNextOffset: null,
    segmentNextOffset: 0,
    lastSegmentSequence: null,
  })

  // The one-shot write failure is consumed, so the real retry can now finish.
  store.dispatch(requestBookRetry(7))
  await waitForDownload('ready')
})

// Fail a later request only after segment zero has committed. Subsequent tests
// independently exercise retry, fresh-store reopen, and version invalidation.
async function interruptAfterFirstSegmentBatch() {
  respondToRequest = (request) => {
    if (
      isContentRequest(request, 'segments') &&
      new URL(request.url).searchParams.get('offset') === '1'
    ) {
      return Response.json(
        { error: { code: 'internal_error', message: 'Try again' } },
        { status: 500 },
      )
    }
    return respondWithBookFixture(request)
  }

  store.dispatch(requestBookLoad(7))
  await waitForDownload('error')

  expect((await database.content.get(7))?.progress).toEqual({
    sectionNextOffset: null,
    segmentNextOffset: 1,
    lastSegmentSequence: 0,
  })
  expect(await database.segments.count()).toBe(1)
}

function getRequestedOffsets(
  requests: Request[],
  resource: 'sections' | 'segments',
) {
  return requests
    .filter((request) => isContentRequest(request, resource))
    .map((request) => Number(new URL(request.url).searchParams.get('offset')))
}

it('resumes a failed segment stream without fetching committed batches again', async () => {
  await interruptAfterFirstSegmentBatch()
  const requestCount = httpRequests.length

  // The completed sections and first text batch are already durable.
  respondToRequest = respondWithBookFixture
  store.dispatch(requestBookRetry(7))
  const downloadState = await waitForDownload('ready')

  const retryRequests = httpRequests.slice(requestCount)
  expect(getRequestedOffsets(retryRequests, 'sections')).toEqual([])
  expect(getRequestedOffsets(retryRequests, 'segments')).toEqual([1])
  expect(downloadState.segmentStoredCount).toBe(2)
  expect(downloadState.lastSegmentSequence).toBe(3)
  expect(await database.segments.count()).toBe(2)
})

it('restores progress from IndexedDB after reopening with a fresh Redux store', async () => {
  await interruptAfterFirstSegmentBatch()
  store.dispatch(archiveApi.util.resetApiState())
  store = createAppStore()
  const releaseResponse = createDeferred<Response>()
  const requestCount = httpRequests.length

  // Hold the remaining response so restored progress can be observed before it commits.
  respondToRequest = (request) =>
    isContentRequest(request, 'segments')
      ? releaseResponse.promise
      : respondWithBookFixture(request)
  store.dispatch(requestBookLoad(7))

  try {
    await vi.waitFor(() =>
      expect(getDownloadState()).toMatchObject({
        status: 'partial',
        sectionStoredCount: 2,
        sectionsComplete: true,
        segmentStoredCount: 1,
        lastSegmentSequence: 0,
      }),
    )
    expect(
      getRequestedOffsets(httpRequests.slice(requestCount), 'segments'),
    ).toEqual([1])
  } finally {
    releaseResponse.resolve(
      Response.json({
        content_version: version,
        items: [segments[1]],
        next_offset: null,
      }),
    )
  }

  await waitForDownload('ready')
})

it('resumes section preorder and resolves roots across the stored page boundary', async () => {
  let failSecondSection = true
  respondToRequest = (request) => {
    if (!isContentRequest(request, 'sections'))
      return respondWithBookFixture(request)
    const offset = Number(new URL(request.url).searchParams.get('offset'))

    if (offset === 1 && failSecondSection) {
      return Response.json(
        { error: { code: 'internal_error', message: 'Try again' } },
        { status: 500 },
      )
    }
    return Response.json({
      content_version: version,
      items: [sections[offset]],
      next_offset: offset === 0 ? 1 : null,
    })
  }

  store.dispatch(requestBookLoad(7))
  await waitForDownload('error')
  expect((await database.content.get(7))?.progress?.sectionNextOffset).toBe(1)
  expect(await database.sections.count()).toBe(1)
  expect(await database.segments.count()).toBe(0)

  // The resumed child refers to a parent downloaded before the interruption.
  failSecondSection = false
  const requestCount = httpRequests.length
  store.dispatch(requestBookRetry(7))
  await waitForDownload('ready')

  expect(
    getRequestedOffsets(httpRequests.slice(requestCount), 'sections'),
  ).toEqual([1])
  expect(
    (await database.segments.toArray()).map((row) => row.root_section_id),
  ).toEqual([10, 10])
})

it('discards partial checkpoints when the next manifest announces a new version', async () => {
  await interruptAfterFirstSegmentBatch()
  await database.contentPositions.put({
    bookId: 7,
    version,
    sourceKey: 'a',
    offset: 1,
  })

  serverManifest = { ...published, content_version: nextVersion }
  respondToRequest = respondWithBookFixture
  const requestCount = httpRequests.length
  await loadBook()

  expect(
    getRequestedOffsets(httpRequests.slice(requestCount), 'sections'),
  ).toEqual([0])
  expect(
    getRequestedOffsets(httpRequests.slice(requestCount), 'segments'),
  ).toEqual([0, 1])
  expect((await database.content.get(7))?.version).toBe(nextVersion)
  expect(await database.contentPositions.get(7)).toBeUndefined()
  expect(
    (await database.segments.toArray()).every(
      (row) => row.version === nextVersion,
    ),
  ).toBe(true)
})

it('retries only manifest checks when all batches committed before network loss', async () => {
  let manifestReads = 0
  respondToRequest = (request) => {
    if (isContentRequest(request, 'manifest') && ++manifestReads === 2) {
      throw new TypeError('Network unavailable')
    }
    return respondWithBookFixture(request)
  }

  store.dispatch(requestBookLoad(7))
  await waitForDownload('error')
  expect((await database.content.get(7))?.progress).toMatchObject({
    sectionNextOffset: null,
    segmentNextOffset: null,
  })
  expect((await database.content.get(7))?.complete).toBe(false)

  respondToRequest = respondWithBookFixture
  const requestCount = httpRequests.length
  await loadBook()

  expect(
    getRequestedOffsets(httpRequests.slice(requestCount), 'sections'),
  ).toEqual([])
  expect(
    getRequestedOffsets(httpRequests.slice(requestCount), 'segments'),
  ).toEqual([])
  expect((await database.content.get(7))?.complete).toBe(true)
})

it('rolls back batch rows if saving their checkpoint fails', async () => {
  await interruptAfterFirstSegmentBatch()
  respondToRequest = respondWithBookFixture

  // Fail after bulkAdd, when the same transaction attempts to advance its offset.
  vi.spyOn(database.content, 'update').mockRejectedValueOnce(
    new DOMException('Full', 'QuotaExceededError'),
  )
  store.dispatch(requestBookRetry(7))
  await waitForDownload('error')

  expect(await database.segments.count()).toBe(1)
  expect((await database.content.get(7))?.progress?.segmentNextOffset).toBe(1)

  store.dispatch(requestBookRetry(7))
  await waitForDownload('ready')
  expect(await database.segments.count()).toBe(2)
})

it('retains committed batches when closing during the next network request', async () => {
  const releaseResponse = createDeferred<Response>()
  respondToRequest = (request) =>
    isContentRequest(request, 'segments') &&
    new URL(request.url).searchParams.get('offset') === '1'
      ? releaseResponse.promise
      : respondWithBookFixture(request)
  store.dispatch(requestBookLoad(7))

  try {
    await vi.waitFor(() =>
      expect(getDownloadState()?.segmentStoredCount).toBe(1),
    )
    store.dispatch(requestBookClose(7))
    await waitForDownload('idle')

    expect((await database.content.get(7))?.progress?.segmentNextOffset).toBe(1)
    expect(await database.segments.count()).toBe(1)
  } finally {
    releaseResponse.resolve(
      Response.json({
        content_version: version,
        items: [segments[1]],
        next_offset: null,
      }),
    )
  }

  respondToRequest = respondWithBookFixture
  const requestCount = httpRequests.length
  await loadBook()
  expect(
    getRequestedOffsets(httpRequests.slice(requestCount), 'segments'),
  ).toEqual([1])
})

it('restarts legacy incomplete caches that have no durable checkpoints', async () => {
  await interruptAfterFirstSegmentBatch()
  await database.content.update(7, { progress: undefined })
  respondToRequest = respondWithBookFixture
  const requestCount = httpRequests.length

  // A pre-resume cache cannot prove its offsets. Replace its partial rows once;
  // complete legacy caches still use the existing manifest-only reuse path.
  await loadBook()

  expect(
    getRequestedOffsets(httpRequests.slice(requestCount), 'sections'),
  ).toEqual([0])
  expect(
    getRequestedOffsets(httpRequests.slice(requestCount), 'segments'),
  ).toEqual([0, 1])
  expect(await database.segments.count()).toBe(2)
})

it('cancels before start and immediately reopens without overlapping operations', async () => {
  // Issue all three intents synchronously, before the first load can finish.
  store.dispatch(requestBookLoad(7))
  store.dispatch(requestBookClose(7))
  store.dispatch(requestBookLoad(7))

  await waitForDownload('ready')

  expect(await database.segments.count()).toBe(2)
})

it('ignores a late network response after close, then allows a new load', async () => {
  // This fake fetch deliberately ignores abort and remains pending. RTK and the
  // sync workflow must reject its eventual response after the book has closed.
  const late = createDeferred<Response>()
  respondToRequest = (request) =>
    isContentRequest(request, 'segments')
      ? late.promise
      : respondWithBookFixture(request)
  store.dispatch(requestBookLoad(7))
  await vi.waitFor(() =>
    expect(
      httpRequests.some((request) => isContentRequest(request, 'segments')),
    ).toBe(true),
  )

  store.dispatch(requestBookClose(7))
  await waitForDownload('idle')

  // Deliver the obsolete response, then let a new request use the normal server.
  late.resolve(
    Response.json({
      content_version: version,
      items: segments,
      next_offset: null,
    }),
  )
  respondToRequest = respondWithBookFixture
  await loadBook()
  expect(await database.segments.count()).toBe(2)
})

it('waits for an in-flight write before removal and reopening', async () => {
  // IndexedDB writes are not abortable. Hold the first real write while requesting
  // removal, so cleanup has to wait instead of racing with that write.
  const releaseWrite = createDeferred<void>()
  const write = database.segments.bulkAdd.bind(database.segments)
  const pendingWrite = vi
    .spyOn(database.segments, 'bulkAdd')
    .mockImplementationOnce((rows) =>
      Dexie.Promise.resolve(Dexie.waitFor(releaseWrite.promise)).then(() =>
        write(rows),
      ),
    )

  store.dispatch(requestBookLoad(7))

  try {
    await vi.waitFor(() => expect(pendingWrite).toHaveBeenCalled())
    store.dispatch(requestBookRemoval(7))

    // The removal is queued; the old operation still owns the active request ID.
    expect(getDownloadState()?.status).toBe('removing')
    expect(getDownloadState()?.activeRequestId).not.toBeNull()
  } finally {
    releaseWrite.resolve()
  }

  await waitForDownload('idle')

  expect(await database.content.count()).toBe(0)
  expect(await database.segments.count()).toBe(0)

  // A clean reopen proves the old writer cannot repopulate or corrupt new staging.
  await loadBook()
})

it('keeps a completed cache when closing the book', async () => {
  await loadBook()

  store.dispatch(requestBookClose(7))
  await waitForDownload('idle')

  expect((await database.content.get(7))?.complete).toBe(true)
})

it('serializes a close and immediate reopen behind a pending database write', async () => {
  // The old transaction must commit its checkpoint before the replacement load resumes.
  const releaseWrite = createDeferred<void>()
  const write = database.segments.bulkAdd.bind(database.segments)
  const pendingWrite = vi
    .spyOn(database.segments, 'bulkAdd')
    .mockImplementationOnce((rows) =>
      Dexie.Promise.resolve(Dexie.waitFor(releaseWrite.promise)).then(() =>
        write(rows),
      ),
    )

  store.dispatch(requestBookLoad(7))

  try {
    await vi.waitFor(() => expect(pendingWrite).toHaveBeenCalled())

    store.dispatch(requestBookClose(7))
    store.dispatch(requestBookLoad(7))
  } finally {
    releaseWrite.resolve()
  }

  await waitForDownload('ready')

  // Exactly one replacement dataset remains; no duplicated or late old rows.
  expect(await database.content.count()).toBe(1)
  expect(await database.segments.count()).toBe(2)
})

it('allows independent books to download without cancelling each other', async () => {
  // Both book URLs intentionally receive the same small fixture. Local bookId
  // ownership must still isolate their requests and stored rows.
  store.dispatch(requestBookLoad(7))
  store.dispatch(requestBookLoad(8))

  await Promise.all([waitForDownload('ready', 7), waitForDownload('ready', 8)])

  expect(await database.content.count()).toBe(2)
})

it('normalizes relative file URLs before saving the manifest', async () => {
  // The API describes a PDF with a relative URL. No PDF bytes should be requested.
  serverManifest = {
    ...serverManifest,
    source_pdf_file_id: 9,
    files: [
      {
        id: 9,
        kind: 'source_pdf',
        book_id: 7,
        section_id: null,
        byte_size: 1,
        metadata: { page_count: 1 },
        url: '/api/v1/files/9',
      },
    ],
  }

  await loadBook()

  const expectedFileUrl = new URL(serverManifest.files[0].url, apiBaseUrl).href

  expect((await database.content.get(7))?.manifest.files[0].url).toBe(
    expectedFileUrl,
  )
  expect(httpRequests.some((request) => request.url === expectedFileUrl)).toBe(
    false,
  )
})

it('completes synchronization without rereading stored segment text', async () => {
  // Observe real Dexie reads. Writes do not invoke this reading hook.
  const trackRead = vi.fn((row) => row)
  database.segments.hook('reading', trackRead)

  try {
    await loadBook()

    expect(trackRead).not.toHaveBeenCalled()
  } finally {
    database.segments.hook('reading').unsubscribe(trackRead)
  }
})

it.each([2, 3, 4])(
  'upgrades schema v%s preserving recordings and saved positions',
  async (oldVersion) => {
    // Recreate a database as an older application version would have written it.
    // v2 has recordings only; v3/v4 also have incompatible structured projections.
    database.close()
    await Dexie.delete(database.name)
    const old = new Dexie(database.name)
    old.version(oldVersion).stores({
      recordings: 'id, createdAt',
      ...(oldVersion > 2
        ? {
            content: 'bookId',
            sections: '[bookId+version+id], bookId',
            segments: '[bookId+version+sequence], bookId',
            contentPositions: 'bookId',
          }
        : {}),
    })

    // Recording bytes are durable user data, not disposable imported text.
    await old.table('recordings').put({
      id: 'recording',
      createdAt: '2026-10-24T00:00:00Z',
      durationMs: 1,
      mimeType: 'audio/webm',
      size: 1,
      blob: new Blob(['voice']),
    })

    // These old content rows should be cleared; the logical position should survive.
    if (oldVersion > 2) {
      await old
        .table('content')
        .put({ bookId: 7, version, manifest: published, complete: true })
      await old.table('segments').put({ bookId: 7, version, sequence: 0 })
      await old
        .table('contentPositions')
        .put({ bookId: 7, version, sourceKey: 'a', offset: 3 })
    }
    old.close()

    // Opening the production database applies its actual Dexie upgrades.
    await database.open()

    expect(await database.recordings.count()).toBe(1)
    expect(await database.content.count()).toBe(0)
    expect(await database.segments.count()).toBe(0)
    if (oldVersion > 2)
      expect((await database.contentPositions.get(7))?.offset).toBe(3)

    // Refetching the projection after upgrade must also leave recordings intact.
    await loadBook()

    expect(await database.recordings.count()).toBe(1)
  },
)
