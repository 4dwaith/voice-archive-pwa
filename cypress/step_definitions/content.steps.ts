import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'
import { READER_PREFERENCES_KEY } from '../../src/data/readerPreferences'
import mediaFixture from '../fixtures/content-media.json'
import type { contentTestHarness } from '../../src/testing/contentTestHarness'
import type { StoredReaderMeasurement } from '../../src/models/reader'
import type {
  ContentManifestOutput,
  SectionReadOutput,
  SegmentReadOutput,
} from '../../src/api-client/generated/schemas'

const version = 'a3027b66-924c-4c9a-aad5-660ba7a733bc'
const nextVersion = '1ac04088-bfcb-44e0-bcdf-ff025c93dcac'
const searchPrefix = `search target. ${'Opening chapter text. '.repeat(500)}`
const apiUrl = () => Cypress.expose('apiUrl') as string
let id = 7
let currentVersion = version
let state: 'published' | 'empty' = 'published'
let liveIds: number[] = []
let requestedSectionOffsets: number[] = []
let requestedSegmentOffsets: number[] = []
const section: SectionReadOutput = {
  id: 1,
  source_key: 'chapter',
  sequence: 0,
  parent_id: null,
  kind: 'chapter',
  title: 'Chapter',
  sibling_sequence: 0,
  audio_file_id: null,
  first_segment_source_key: 'a',
}
const segment: SegmentReadOutput = {
  id: 1,
  source_key: 'a',
  section_id: 1,
  sequence: 0,
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
}
const input = {
  schema_version: 1,
  sections: [
    {
      source_key: 'chapter',
      kind: 'chapter',
      title: 'Chapter',
      sibling_sequence: 0,
    },
  ],
  segments: [segment, { ...segment, id: 2, source_key: 'b', sequence: 2 }].map(
    (row) => ({
      source_key: row.source_key,
      section_source_key: 'chapter',
      sequence: row.sequence,
      kind: row.kind,
      html_content: row.html_content,
      language: row.language,
    }),
  ),
}

function harness() {
  return cy
    .window()
    .should('have.property', 'contentTestHarness')
    .then(
      (win) =>
        (win as unknown as { contentTestHarness: typeof contentTestHarness })
          .contentTestHarness,
    )
}
function mockBook(
  options: {
    chapters?: boolean
    search?: boolean
    nested?: boolean
    slow?: boolean
    cover?: boolean
    slowSecond?: boolean
    failOnce?: boolean
    changeDuringDownload?: boolean
  } = {},
) {
  id = 7
  currentVersion = version
  state = 'published'
  requestedSectionOffsets = []
  requestedSegmentOffsets = []
  let failed = false
  let versionChanged = false
  cy.intercept('GET', `${apiUrl()}/api/v1/books?*`, {
    body: {
      items: [
        {
          id,
          title: 'Sync book',
          language: 'kn',
          author: null,
          description: null,
          cover_file_id: options.cover ? 99 : null,
          cover_url: options.cover ? '/api/v1/files/99' : null,
          source_pdf_file_id: null,
          source_pdf_url: null,
          created_at: '2026-10-23T00:00:00Z',
          updated_at: '2026-10-23T00:00:00Z',
        },
      ],
      total: 1,
      offset: 0,
      limit: 24,
    },
  })
  cy.intercept('GET', `${apiUrl()}/api/v1/files/99`, {
    headers: { 'content-type': 'image/svg+xml' },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="160"><rect width="100" height="160" fill="navy"/></svg>',
  })
  cy.intercept('GET', `${apiUrl()}/api/v1/books/${id}/content`, (request) => {
    const manifest: ContentManifestOutput = {
      state,
      content_version: state === 'published' ? currentVersion : null,
      schema_version: state === 'published' ? 1 : null,
      imported_at: state === 'published' ? '2026-10-23T00:00:00Z' : null,
      source_pdf_file_id: null,
      section_count:
        state === 'published'
          ? options.chapters
            ? 20
            : options.nested
              ? 2
              : 1
          : 0,
      segment_count: state === 'published' ? 2 : 0,
      files: [],
    }
    request.reply({ body: manifest, delay: options.slow ? 1000 : 0 })
  })
  cy.intercept(
    'GET',
    `${apiUrl()}/api/v1/books/${id}/sections?*`,
    (request) => {
      requestedSectionOffsets.push(
        Number(new URL(request.url).searchParams.get('offset') ?? 0),
      )
      request.reply({
        body: {
          content_version: currentVersion,
          items:
            options.nested || options.chapters
              ? [
                  section,
                  ...(options.chapters
                    ? Array.from({ length: 18 }, (_, index) => ({
                        ...section,
                        id: index + 3,
                        source_key: `empty-${index}`,
                        sequence: index + 1,
                        title: `Empty chapter ${index + 1}`,
                        first_segment_source_key: null,
                      }))
                    : []),
                  {
                    ...section,
                    id: 2,
                    parent_id: options.chapters ? null : 1,
                    sequence: options.chapters ? 19 : 1,
                    kind: 'section',
                    source_key: 'nested',
                    title: options.chapters
                      ? 'Second chapter'
                      : 'Nested destination',
                    first_segment_source_key: 'b',
                  },
                ]
              : [section],
          next_offset: null,
        },
      })
    },
  )
  cy.intercept(
    'GET',
    `${apiUrl()}/api/v1/books/${id}/segments?*`,
    (request) => {
      requestedSegmentOffsets.push(
        Number(new URL(request.url).searchParams.get('offset') ?? 0),
      )
      if (options.changeDuringDownload && !versionChanged) {
        versionChanged = true
        currentVersion = nextVersion
        request.reply({
          statusCode: 412,
          body: {
            error: {
              code: 'content_version_mismatch',
              message: 'Content changed',
            },
          },
        })
        return
      }
      const second =
        Number(new URL(request.url).searchParams.get('offset') ?? 0) > 0

      // Fail only after the first segment batch has been committed. Cleanup
      // must preserve actual staged rows and resume after the first batch.
      if (options.failOnce && second && !failed) {
        failed = true
        request.reply({
          statusCode: 500,
          body: {
            error: {
              code: 'internal_error',
              message: 'An unexpected error occurred',
            },
          },
        })
        return
      }
      request.reply({
        body: {
          content_version: currentVersion,
          items: [
            {
              ...segment,
              id: second ? 2 : 1,
              source_key: second ? 'b' : 'a',
              sequence: second ? 2 : 0,
              ...(options.nested || options.chapters
                ? {
                    section_id: second ? 2 : 1,
                    html_content: `<p>${second ? 'Nested destination text.' : options.search ? `${searchPrefix}search target.` : 'Opening chapter text. '.repeat(500)}</p>`,
                    text_content: second
                      ? 'Nested destination text.'
                      : options.search
                        ? `${searchPrefix}search target.`
                        : 'Opening chapter text. '.repeat(500),
                  }
                : {}),
            },
          ],
          next_offset: second ? null : 1,
        },
        delay: second && options.slowSecond ? 1600 : 0,
      })
    },
  )
}

beforeEach(() => {
  liveIds = []
})
afterEach(() => {
  for (const bookId of liveIds)
    cy.request('DELETE', `${apiUrl()}/api/v1/books/${bookId}`)
})

function preparePublishedBook() {
  if (Cypress.expose('mode') !== 'live') {
    mockBook()
    return
  }
  cy.request('POST', `${apiUrl()}/api/v1/books`, {
    title: 'Sync book',
    language: 'kn',
  }).then((response) => {
    id = response.body.id
    liveIds.push(id)
    cy.request(
      'POST',
      `${apiUrl()}/api/v1/books/${id}/content-imports`,
      input,
    ).then((response) => {
      currentVersion = response.body.content_version
    })
  })
}

Given('a published synchronization book', preparePublishedBook)

function prepareBookWithMedia() {
  if (Cypress.expose('mode') !== 'live') {
    mockBook()
    const files = [
      {
        id: 101,
        kind: 'source_pdf',
        book_id: id,
        section_id: null,
        byte_size: 500,
        metadata: { page_count: 1 },
        url: '/api/v1/files/101',
      },
      {
        id: 102,
        kind: 'audio_chapter',
        book_id: null,
        section_id: 1,
        byte_size: 500,
        metadata: { duration_ms: 1000, sample_rate: 44100, channels: 1 },
        url: '/api/v1/files/102',
      },
    ]
    cy.intercept('GET', `${apiUrl()}/api/v1/books/${id}/content`, {
      body: {
        state: 'published',
        content_version: version,
        schema_version: 1,
        imported_at: '2026-10-23T00:00:00Z',
        source_pdf_file_id: 101,
        section_count: 1,
        segment_count: 2,
        files,
      },
    })
    cy.intercept('GET', `${apiUrl()}/api/v1/books/${id}/sections?*`, {
      body: {
        content_version: version,
        items: [{ ...section, audio_file_id: 102 }],
        next_offset: null,
      },
    })
    for (const [fileId, encoded, type] of [
      [101, mediaFixture.pdf, 'application/pdf'],
      [102, mediaFixture.audio, 'audio/mpeg'],
    ] as const) {
      const bytes = Cypress.Buffer.from(encoded, 'base64')
      cy.intercept('GET', `${apiUrl()}/api/v1/files/${fileId}`, (request) => {
        const partial =
          request.headers.range &&
          (!request.headers['if-range'] ||
            request.headers['if-range'] === '"fixture"')
        const body = partial ? bytes.subarray(0, 16) : bytes
        request.reply({
          statusCode: partial ? 206 : 200,
          body: body.buffer.slice(
            body.byteOffset,
            body.byteOffset + body.byteLength,
          ),
          headers: {
            'content-type': type,
            etag: '"fixture"',
            'accept-ranges': 'bytes',
            ...(partial
              ? { 'content-range': `bytes 0-15/${bytes.length}` }
              : {}),
          },
        })
      })
    }
    return
  }
  cy.visit('/')
  cy.window().then(async (win) => {
    async function upload(kind: string, encoded: string, type: string) {
      const form = new FormData()
      form.append(
        'file',
        Cypress.Blob.base64StringToBlob(encoded, type),
        `sample.${kind === 'source_pdf' ? 'pdf' : 'mp3'}`,
      )
      const response = await win.fetch(`${apiUrl()}/api/v1/files/${kind}`, {
        method: 'POST',
        body: form,
      })
      expect(response.status).to.equal(201)
      return (await response.json()).id as number
    }
    const pdf = await upload('source_pdf', mediaFixture.pdf, 'application/pdf')
    const audio = await upload(
      'audio_chapter',
      mediaFixture.audio,
      'audio/mpeg',
    )
    const response = await win.fetch(`${apiUrl()}/api/v1/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Sync book', language: 'kn' }),
    })
    expect(response.status).to.equal(201)
    id = (await response.json()).id
    liveIds.push(id)
    const payload = {
      ...input,
      source_pdf_file_id: pdf,
      sections: [{ ...input.sections[0], audio_file_id: audio }],
    }
    const publication = await win.fetch(
      `${apiUrl()}/api/v1/books/${id}/content-imports`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    expect(publication.status).to.equal(200)
    currentVersion = (await publication.json()).content_version
  })
}

Given('a fully cached synchronization book', () => {
  preparePublishedBook()

  // The live API assigns the book ID asynchronously; open only after setup.
  cy.then(cacheBookFromLibrary)
})

Given('a fully cached synchronization book with prepared media', () => {
  prepareBookWithMedia()
  cy.then(cacheBookFromLibrary)
})

Given('a slow synchronization book with a cover', () =>
  mockBook({ slow: true, cover: true }),
)
Given('a synchronization book with a slow second batch', () =>
  mockBook({ slowSecond: true }),
)
Given('a synchronization book whose first download fails', () =>
  mockBook({ failOnce: true }),
)
function openBookFromLibrary() {
  cy.visit('/')
  harness().then((data) => data.remove(id))
  cy.findByRole('button', { name: 'Select Sync book' }).click()
  cy.location('pathname').should('eq', `/books/${id}`)
}

function waitForBookSynchronization() {
  harness().then((data) => data.waitForCompletion(id))
}

function cacheBookFromLibrary() {
  openBookFromLibrary()
  waitForBookSynchronization()

  // Fixture setup still uses the real application download and IndexedDB.
  harness().then(async (data) => {
    expect((await data.read(id)).content?.complete).to.equal(true)
  })
}

When('I open the synchronization book from the library', openBookFromLibrary)
When('I wait for book synchronization to finish', waitForBookSynchronization)

When('I open the synchronization book directly', () => {
  cy.visit(`/books/${id}`, {
    onBeforeLoad(win) {
      // Direct entry has no BrowserRouter history, even with external entries.
      win.history.replaceState(null, '')
    },
  })
})

When('I use the header Home button', () => {
  cy.findByRole('button', { name: /^Home$/ }).click()
})

When('I go forward in browser history', () => {
  cy.go('forward')
})

Then('I return to the synchronization library', () => {
  cy.location('pathname').should('eq', '/')
  cy.findByRole('button', { name: 'Select Sync book' }).should('be.visible')
  cy.findByRole('button', { name: /^Home$/ }).should('not.exist')
  cy.findByRole('searchbox', { name: 'Search book text' }).should('not.exist')
})

Then('I see its cover and loading text', () => {
  cy.findByRole('status').should('contain.text', 'Loading')
  cy.findByRole('img', { name: 'Cover of Sync book' }).should('be.visible')

  harness().then(async (data) => {
    expect((await data.read(id)).content?.complete).not.to.equal(true)
  })
})
Then('its complete structured dataset is available locally', () => {
  harness().then(async (data) => {
    const cached = await data.read(id)
    expect(cached.content?.complete).to.equal(true)
    expect(cached.segments.map((row) => row.source_key)).to.deep.equal([
      'a',
      'b',
    ])
    expect(cached.readable[0].text_content).to.equal('ಕನ್ನಡ\ntext')
    expect(cached.readable[0].html_content).to.equal(segment.html_content)
  })
})
Then('its first batch is readable without marking the book complete', () => {
  // Poll IndexedDB through the data layer while the second response is delayed.
  harness().then(async (data) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const cached = await data.read(id)
      if (cached.readable.length > 0) {
        expect(cached.content?.complete).to.equal(false)
        expect(cached.readable).to.have.length(1)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
    throw new Error('No progressive batch became available')
  })
})
When('its manifest becomes unreachable', () => {
  cy.intercept('GET', `${apiUrl()}/api/v1/books/${id}/content`, {
    forceNetworkError: true,
  })
})

function readStoredMeasurements() {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<StoredReaderMeasurement[]>((resolve, reject) => {
        const request = win.indexedDB.open('voice-archive-e2e-test')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('measurements')
          const rows = transaction.objectStore('measurements').getAll()
          transaction.oncomplete = () => {
            database.close()
            resolve(rows.result.filter((row) => row.bookId === id))
          }
          transaction.onabort = () => {
            database.close()
            reject(transaction.error)
          }
        }
      }),
  )
}

Given('its reader measurements are committed', () => {
  cy.findByRole('article', { name: 'Book text' }).should(
    'have.attr',
    'aria-busy',
    'false',
  )
  cy.findByRole('button', { name: /^Book$/ }).click()
  cy.findByRole('slider', { name: 'Book page' }).should(($slider) => {
    expect($slider.attr('aria-valuetext')).not.to.contain('total unknown')
  })
  cy.get('[data-reader-measurer]').should('not.exist')
  readStoredMeasurements().then((records) => {
    expect(records).to.have.length(2)
    expect(
      records.every((record) => record.contentVersion === currentVersion),
    ).to.equal(true)
    expect(records.flatMap((record) => record.pages).length).to.be.greaterThan(
      0,
    )
    cy.wrap(records).as('committedMeasurements')
  })
})

Then('the offline reader reuses its stored measurements', () => {
  cy.contains('[role="status"]', 'Available offline.').should('be.visible')
  cy.findByRole('article', { name: 'Book text' }).should(
    'have.attr',
    'aria-busy',
    'false',
  )
  cy.findByRole('button', { name: /^Book$/ }).click()
  cy.findByRole('slider', { name: 'Book page' }).should(($slider) => {
    expect($slider.attr('aria-valuetext')).not.to.contain('total unknown')
  })
  cy.get('[data-reader-measurer]').should('not.exist')
  cy.get<StoredReaderMeasurement[]>('@committedMeasurements').then((before) => {
    readStoredMeasurements().should('deep.equal', before)
  })
})

Then('its cached text remains available offline', () => {
  harness().then(async (data) => {
    expect((await data.open(id)).status).to.equal('offline')
    expect((await data.read(id)).readable).to.have.length(2)
  })
})
type MediaRangeObservation = {
  kind: string
  matchedStatus: number
  contentRange: string | null
  byteLength: number
  contentEncoding: string | null
  staleStatus: number
}

let mediaRangeObservations: MediaRangeObservation[] = []

When('I request conditional byte ranges from its media URLs', () => {
  mediaRangeObservations = []

  harness().then(async (data) => {
    const files = (await data.read(id)).content!.manifest.files

    for (const file of files) {
      // Obtain the current validator, then request sixteen bytes with both a
      // matching and a stale validator. The sync layer fetched no media bytes.
      const first = await fetch(file.url, { headers: { Range: 'bytes=0-15' } })
      const etag = first.headers.get('etag')!
      await first.body?.cancel()

      const matched = await fetch(file.url, {
        headers: { Range: 'bytes=0-15', 'If-Range': etag },
      })
      const byteLength = (await matched.arrayBuffer()).byteLength

      const stale = await fetch(file.url, {
        headers: { Range: 'bytes=0-15', 'If-Range': '"stale"' },
      })
      await stale.body?.cancel()

      mediaRangeObservations.push({
        kind: file.kind,
        matchedStatus: matched.status,
        contentRange: matched.headers.get('content-range'),
        byteLength,
        contentEncoding: matched.headers.get('content-encoding'),
        staleStatus: stale.status,
      })
    }
  })
})

Then('its media responses honor the range conditions', () => {
  expect(mediaRangeObservations.map((file) => file.kind).sort()).to.deep.equal([
    'audio_chapter',
    'source_pdf',
  ])

  for (const response of mediaRangeObservations) {
    // A matching validator permits a partial response with uncompressed bytes.
    expect(response.matchedStatus).to.equal(206)
    expect(response.contentRange).to.match(/^bytes 0-15\//)
    expect(response.byteLength).to.equal(16)
    expect(response.contentEncoding).to.equal(null)

    // A stale validator requires the complete representation instead.
    expect(response.staleStatus).to.equal(200)
  }
})

Then('its committed local batches are retained as incomplete', () => {
  waitForBookSynchronization()

  harness().then(async (data) => {
    const cached = await data.read(id)
    expect(cached.content?.complete).to.equal(false)
    expect(cached.content?.progress).to.deep.equal({
      sectionNextOffset: null,
      segmentNextOffset: 1,
      lastSegmentSequence: 0,
    })
    expect(await data.countStoredRows(id)).to.deep.equal({
      sections: 1,
      segments: 1,
    })
  })
})

Then('its committed batches were not downloaded again', () => {
  expect(requestedSectionOffsets).to.deep.equal([0])
  expect(requestedSegmentOffsets).to.deep.equal([0, 1, 1])
})

Then('I see a book loading error', () => {
  cy.findByRole('alert').should('contain.text', 'couldn’t be loaded')
  cy.findByRole('button', { name: 'Try again' }).should('be.visible')
})
When('I retry the book download', () => {
  cy.findByRole('button', { name: 'Try again' }).click()
})
When('its published content is purged', () => {
  if (Cypress.expose('mode') !== 'live') {
    state = 'empty'
    return
  }
  cy.request(`${apiUrl()}/api/v1/books/${id}/content`).then((response) => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl()}/api/v1/books/${id}/content`,
      headers: { 'If-Match': response.headers.etag },
    })
  })
})
When('its published content is imported again', () => {
  if (Cypress.expose('mode') !== 'live') {
    currentVersion = nextVersion
    return
  }
  cy.request(`${apiUrl()}/api/v1/books/${id}/content`).then((response) => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl()}/api/v1/books/${id}/content`,
      headers: { 'If-Match': response.headers.etag },
    })
    cy.request(
      'POST',
      `${apiUrl()}/api/v1/books/${id}/content-imports`,
      input,
    ).then((response) => {
      currentVersion = response.body.content_version
    })
  })
})
Then('reopening shows no text and clears the local dataset', () => {
  cy.reload()
  cy.location('pathname').should('eq', `/books/${id}`)
  cy.findByRole('status').should('contain.text', 'no text data for this book')
  harness().then(async (data) => {
    expect((await data.open(id)).status).to.equal('empty')
    expect((await data.read(id)).content).to.equal(undefined)
  })
})
Then('reopening downloads the new dataset without leaving the book', () => {
  cy.reload()
  cy.location('pathname').should('eq', `/books/${id}`)
  harness().then(async (data) => {
    expect((await data.open(id)).status).to.equal('ready')
    expect((await data.read(id)).content?.version).to.equal(currentVersion)
  })
})
Given('a book without published text', () => {
  mockBook()
  state = 'empty'
})
Then('the book stays open with a no-text message', () => {
  cy.get('[data-reader]').should('not.exist')
  cy.location('pathname').should('eq', `/books/${id}`)
  cy.findByRole('status').should('contain.text', 'no text data for this book')
})
Given('a synchronization book that changes during download', () =>
  mockBook({ changeDuringDownload: true }),
)
Then('the new dataset is downloaded without leaving the book', () => {
  harness().then(async (data) => {
    expect((await data.open(id)).status).to.equal('ready')
    expect((await data.read(id)).content?.version).to.equal(nextVersion)
  })
  cy.location('pathname').should('eq', `/books/${id}`)
})

Then('I see its first reader page', () => {
  cy.findByRole('article', { name: 'Book text' })
    .should('have.attr', 'aria-busy', 'false')
    .and('have.attr', 'data-reader-page', '1')
    .find('[data-reader-segment-id]')
    .first()
    .should('contain.text', 'text')
})

Then('the ToC fills the reader below the header', () => {
  cy.findByRole('navigation', { name: 'Table of contents' }).should(($toc) => {
    const document = $toc[0].ownerDocument
    const rect = $toc[0].getBoundingClientRect()
    const header = document.querySelector('header')!.getBoundingClientRect()
    const footer = document
      .querySelector('[aria-label="Page navigation"]')!
      .parentElement!.getBoundingClientRect()
    expect(rect.top).to.equal(header.bottom + 2)
    expect(rect.bottom).to.equal(footer.top - 2)
  })
})

When('I tap exposed book text', () => {
  // Tap beside the ToC, inside the overlay's full-height bounds.
  cy.findByRole('article', { name: 'Book text' }).then(($article) => {
    const rect = $article[0].getBoundingClientRect()
    cy.wrap($article).click(rect.width - 30, rect.height / 2)
  })
})

Then('the reader controls are hidden', () => {
  cy.findByRole('button', { name: 'Home' }).should('not.exist')
  cy.findByRole('navigation', { name: 'Table of contents' }).should('not.exist')
  cy.findByRole('button', { name: /reader controls/ }).should('not.exist')
})

When('I select a text segment', () => {
  cy.findByRole('article', { name: 'Book text' })
    .find('[data-reader-segment-id] p')
    .first()
    .dblclick('left')
})

Then('the text segment is selected', () => {
  cy.findByRole('article', { name: 'Book text' })
    .find('[data-reader-segment-id]')
    .first()
    .should('have.attr', 'data-reader-selected', 'true')
})

When('I reveal the reader controls', () => {
  cy.findByRole('region', { name: /^Reader$/ }).trigger('keydown', {
    key: 'Enter',
  })
})

Then('the reader controls are visible', () => {
  cy.findByRole('button', { name: 'Home' }).should('be.visible')
  cy.findByRole('navigation', { name: 'Table of contents' }).should(
    'be.visible',
  )
  cy.findByRole('button', { name: 'Make text larger' }).should('be.enabled')
})

Given('a synchronization book with a nested destination', () =>
  mockBook({ nested: true }),
)

When('I select the nested ToC destination', () => {
  // Cypress's focusable-element list omits native summary elements.
  cy.get('summary[aria-label="Subsections of Chapter"]').then(($summary) => {
    $summary[0].focus()
  })
  cy.focused()
    .should('have.attr', 'aria-label', 'Subsections of Chapter')
    .and('have.css', 'outline-style', 'solid')
  cy.press(Cypress.Keyboard.Keys.ENTER)
  cy.findByRole('button', { name: 'Nested destination' }).should('not.exist')

  cy.press(Cypress.Keyboard.Keys.ENTER)
  cy.findByRole('navigation', { name: 'Table of contents' }).within(() => {
    cy.get('li > button').should(($buttons) => {
      expect(
        [...$buttons].map((button) => button.textContent?.trim()),
      ).to.deep.equal(['Chapter', 'Nested destination'])
    })
    cy.findByRole('button', { name: 'Nested destination' }).should('be.enabled')
  })
  cy.findByRole('button', { name: 'Nested destination' }).click()
  cy.findByRole('button', { name: 'Nested destination' }).should(
    'have.attr',
    'aria-current',
    'true',
  )
  cy.findByRole('region', { name: /^Reader$/ }).trigger('keydown', {
    key: 'Escape',
  })
})

Then('I see the nested section text', () => {
  cy.findByRole('article', { name: 'Book text' })
    .should('have.attr', 'aria-busy', 'false')
    .should(($article) =>
      expect(Number($article.attr('data-reader-page'))).to.be.greaterThan(1),
    )
    .find('[data-reader-segment-id="2"]')
    .should('be.visible')
    .and('have.text', 'Nested destination text.')
})

Given('a synchronization book with two chapters', () =>
  mockBook({ chapters: true }),
)

When('I move forward one chapter page', () => {
  cy.findByRole('navigation', { name: 'Table of contents' })
    .findByRole('button', { name: /^Chapter$/ })
    .should('be.enabled')
    .click()
  cy.findByRole('button', { name: /^Forward 1 page$/ })
    .should('be.enabled')
    .click()
})

Then('the second chapter page is displayed', () => {
  cy.findByRole('article', { name: 'Book text' }).should(
    'have.attr',
    'data-reader-page',
    '2',
  )
  cy.findByRole('slider', { name: 'Chapter page' }).should(
    'have.attr',
    'aria-valuenow',
    '2',
  )
})

When('I jump to the last indexed book page', () => {
  cy.findByRole('button', { name: 'Second chapter' }).should(($target) => {
    const body = $target[0].closest('nav')!.lastElementChild!
    expect($target[0].getBoundingClientRect().top).to.be.greaterThan(
      body.getBoundingClientRect().bottom,
    )
  })
  cy.findByRole('button', { name: /^Book$/ }).click()
  cy.findByRole('slider', { name: 'Book page' })
    .should(($slider) => {
      expect($slider.attr('aria-valuetext')).not.to.contain('total unknown')
      expect(Number($slider.attr('aria-valuemax'))).to.be.greaterThan(2)
    })
    .focus()
    .type('{end}')
})

Then('the second chapter opens at the indexed book boundary', () => {
  cy.findByRole('button', { name: 'Second chapter' })
    .should('have.attr', 'aria-current', 'true')
    .should(($target) => {
      const body = $target[0].closest('nav')!.lastElementChild!
      const viewport = body.getBoundingClientRect()
      const target = $target[0].getBoundingClientRect()
      expect(target.top).to.be.at.least(viewport.top)
      expect(target.bottom).to.be.at.most(viewport.bottom)
    })
  cy.focused().should('have.attr', 'aria-label', 'Book page')
  cy.findByRole('navigation', { name: 'Table of contents' })
    .findByRole('button', { name: /^Chapter$/ })
    .should('not.have.attr', 'aria-current')
  cy.findByRole('slider', { name: 'Book page' }).should(($slider) => {
    expect($slider.attr('aria-valuenow')).to.equal(
      $slider.attr('aria-valuemax'),
    )
  })
  cy.findByRole('button', { name: /^Forward 1 page$/ }).should('be.disabled')
  cy.findByRole('article', { name: 'Book text' })
    .should('have.attr', 'data-reader-page', '1')
    .find('[data-reader-segment-id="2"]')
    .should('have.text', 'Nested destination text.')
})

When('I collapse the table of contents', () => {
  cy.get('[data-reader-page-window]').then(($window) => {
    const rect = $window[0].getBoundingClientRect()
    cy.wrap([rect.x, rect.y, rect.width, rect.height]).as(
      'textBeforeTocCollapse',
    )
  })
  cy.findByRole('button', { name: 'Collapse table of contents' }).click()
})

Then('the ToC shrinks to its toggle without moving the text or footer', () => {
  cy.findByRole('button', { name: 'Show table of contents' }).should(
    ($toggle) => {
      const toggle = $toggle[0]
      const nav = toggle.closest('nav')!
      expect(nav.getBoundingClientRect().height).to.equal(
        toggle.getBoundingClientRect().height,
      )
      expect(nav.parentElement!.getBoundingClientRect().height).to.equal(
        nav.getBoundingClientRect().height + 4,
      )
      const document = toggle.ownerDocument
      expect(
        document
          .querySelector('[aria-label="Page navigation"]')!
          .getBoundingClientRect().bottom,
      ).to.equal(
        document.querySelector('[data-reader]')!.getBoundingClientRect().bottom,
      )
    },
  )
  cy.get<number[]>('@textBeforeTocCollapse').then((before) => {
    cy.get('[data-reader-page-window]').should(($window) => {
      const rect = $window[0].getBoundingClientRect()
      expect([rect.x, rect.y, rect.width, rect.height]).to.deep.equal(before)
    })
  })
})

When('I expand the table of contents', () => {
  cy.findByRole('button', { name: 'Show table of contents' }).click()
})

When('I focus the text and hide the controls', () => {
  cy.findByRole('article', { name: 'Book text' })
    .should('have.attr', 'aria-busy', 'false')
    .focus()
    .type('{esc}')
})

When('I focus a text segment and hide the controls', () => {
  cy.findByRole('article', { name: 'Book text' })
    .should('have.attr', 'aria-busy', 'false')
    .find('[data-reader-segment-id]')
    .first()
    .focus()
  cy.press(Cypress.Keyboard.Keys.ESC)
})

When('I press the right arrow key', () => {
  cy.press(Cypress.Keyboard.Keys.RIGHT)
})

When('I press the left arrow key', () => {
  cy.press(Cypress.Keyboard.Keys.LEFT)
})

Then('the reader keeps keyboard focus', () => {
  cy.findByRole('region', { name: /^Reader$/ })
    .should('be.focused')
    .and('have.css', 'outline-style', 'none')
})

When('I swipe left across the book text', () => {
  cy.findByRole('article', { name: 'Book text' }).then(async ($article) => {
    const rect = $article[0].getBoundingClientRect()
    const y = rect.top + rect.height / 2
    const startX = rect.right - 80
    const endX = rect.left + 80
    // Chrome generates real touch/pointer events, including cancellation and clicks.
    await Cypress.automation('remote:debugger:protocol', {
      command: 'Input.dispatchTouchEvent',
      params: { type: 'touchStart', touchPoints: [{ x: startX, y, id: 1 }] },
    })
    for (let step = 1; step <= 4; step++) {
      await Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchTouchEvent',
        params: {
          type: 'touchMove',
          touchPoints: [{ x: startX + ((endX - startX) * step) / 4, y, id: 1 }],
        },
      })
    }
    await Cypress.automation('remote:debugger:protocol', {
      command: 'Input.dispatchTouchEvent',
      params: { type: 'touchEnd', touchPoints: [] },
    })
  })
})

Then('the text shows page {int}', (page: number) => {
  cy.findByRole('article', { name: 'Book text' }).should(
    'have.attr',
    'data-reader-page',
    String(page),
  )
})

When('I press the previous-page key', () => {
  cy.get('body').type('{pageup}')
})

When('I enlarge the text and move to an interior position', () => {
  cy.findByRole('button', { name: 'Make text larger' }).click()
  cy.findByRole('article', { name: 'Book text' }).should(
    'have.attr',
    'aria-busy',
    'false',
  )
  cy.findByRole('button', { name: /^Forward 1 page$/ })
    .should('be.enabled')
    .click()
  cy.findByRole('article', { name: 'Book text' }).should(
    'have.attr',
    'data-reader-page',
    '2',
  )
  cy.window()
    .should((win) => {
      const saved = JSON.parse(
        win.localStorage.getItem(READER_PREFERENCES_KEY)!,
      )
      expect(saved.textSizeStep).to.equal(1)
      expect(saved.positions[id].sourceKey).to.equal('a')
      expect(saved.positions[id].offset).to.be.greaterThan(0)
    })
    .then((win) => {
      cy.wrap(
        JSON.parse(win.localStorage.getItem(READER_PREFERENCES_KEY)!).positions[
          id
        ],
      ).as('savedPosition')
    })
})

When('I reload the reader', () => {
  cy.reload()
})

Then('the saved interior position and text size are restored', () => {
  cy.findByRole('article', { name: 'Book text' })
    .should('have.attr', 'aria-busy', 'false')
    .and('have.attr', 'data-reader-page', '2')
  cy.contains('Text size 112.5 percent').should('exist')
  cy.get('@savedPosition').then((position) => {
    cy.window().should((win) => {
      expect(
        JSON.parse(win.localStorage.getItem(READER_PREFERENCES_KEY)!).positions[
          id
        ],
      ).to.deep.equal(position)
    })
  })
})

When('I save a position for an obsolete version and reload', () => {
  cy.window().then((win) => {
    win.localStorage.setItem(
      READER_PREFERENCES_KEY,
      JSON.stringify({
        textSizeStep: 0,
        positions: {
          [id]: { version: 'obsolete', sourceKey: 'b', offset: 2 },
        },
      }),
    )
  })
  cy.reload()
})

Given('a searchable synchronization book', () => {
  cy.viewport(700, 720)
  mockBook({ nested: true, search: true })
})

Then('book search is unavailable', () => {
  cy.findByRole('searchbox', { name: 'Search book text' }).should('not.exist')
})

Then('book search is available', () => {
  cy.findByRole('searchbox', { name: 'Search book text' }).should('be.visible')
})

When('I submit a book search with Enter', () => {
  cy.findByRole('form', { name: 'Book search' }).should(($form) => {
    const form = $form[0].getBoundingClientRect()
    const header = $form[0].closest('header')!.getBoundingClientRect()
    expect(form.x + form.width / 2).to.be.closeTo(
      header.x + header.width / 2,
      1,
    )
  })
  cy.findByRole('article', { name: 'Book text' }).should(
    'have.attr',
    'aria-busy',
    'false',
  )
  cy.findByRole('searchbox', { name: 'Search book text' }).type(
    'search target{enter}',
  )
})

Then('the search modal protects the reader and shows both occurrences', () => {
  cy.findByRole('dialog', { name: 'Search results' }).should(($dialog) => {
    const rect = $dialog[0].getBoundingClientRect()
    expect(
      $dialog[0].ownerDocument
        .elementFromPoint(rect.x + rect.width / 2, rect.y + 20)
        ?.closest('[role="dialog"]'),
    ).to.equal($dialog[0])
  })
  cy.focused().should('have.text', 'Search results')
  cy.get('input[aria-label="Search book text"]').focus()
  cy.focused().should(($focused) =>
    expect($focused.closest('[role="dialog"]')).to.have.length(1),
  )
  cy.focused().type('{pagedown}{rightarrow}')
  cy.get('article[aria-label="Book text"]').should(
    'have.attr',
    'data-reader-page',
    '1',
  )
  cy.findByRole('list', { name: 'Matching occurrences' })
    .find('strong')
    .should('have.length', 2)
    .each(($match) => expect($match.text()).to.equal('search target'))
})

When('I dismiss search with Escape', () => {
  cy.findByRole('dialog').type('{esc}')
  cy.findByRole('dialog').should('not.exist')
})

Then('focus returns to the search results button', () => {
  cy.focused().should('have.attr', 'aria-label', 'Reopen search results')
  cy.findByRole('button', { name: 'Home' }).should('be.visible')
})

When('I reopen search results', () => {
  cy.findByRole('button', { name: 'Reopen search results' }).click()
})

When('I open the later matching occurrence', () => {
  cy.findByRole('list', { name: 'Matching occurrences' })
    .findAllByRole('button')
    .last()
    .click()
})

Then('the exact later match is displayed', () => {
  cy.findByRole('dialog').should('not.exist')
  cy.findByRole('article', { name: 'Book text' })
    .should('have.attr', 'aria-busy', 'false')
    .should(($article) =>
      expect(Number($article.attr('data-reader-page'))).to.be.greaterThan(1),
    )
  cy.window().should((win) => {
    expect(
      JSON.parse(win.localStorage.getItem(READER_PREFERENCES_KEY)!).positions[
        id
      ],
    ).to.deep.equal({ version, sourceKey: 'a', offset: searchPrefix.length })
  })
})

Then('both matching occurrences remain available', () => {
  cy.findByRole('list', { name: 'Matching occurrences' })
    .findAllByRole('button')
    .should('have.length', 2)
})

When('I clear search and submit it again by button', () => {
  cy.findByRole('button', { name: 'Clear search' }).click()
  cy.findByRole('dialog').should('not.exist')
  cy.focused()
    .should('have.attr', 'aria-label', 'Search book text')
    .and('have.value', '')
  cy.findByRole('button', { name: 'Reopen search results' }).should(
    'be.disabled',
  )
  cy.findByRole('searchbox', { name: 'Search book text' }).type('search target')
  cy.findByRole('button', { name: /^Search$/ }).click()
})

Then('the book search results are cleared', () => {
  cy.findByRole('searchbox', { name: 'Search book text' }).should(
    'have.value',
    '',
  )
  cy.findByRole('button', { name: 'Reopen search results' }).should(
    'be.disabled',
  )
  cy.findByRole('dialog').should('not.exist')
})
