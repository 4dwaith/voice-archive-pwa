import { requestApi } from '../support/api'
import {
  Given,
  When,
  Then,
  Before,
  After,
} from '@badeball/cypress-cucumber-preprocessor'
import { READER_PREFERENCES_KEY } from '../../src/data/readerPreferences'
import mediaFixture from '../fixtures/content-media.json'
import type { contentTestHarness } from '../../src/testing/contentTestHarness'
import type { StoredReaderMeasurement } from '../../src/models/reader'
import type {
  ContentManifestOutput,
  SectionReadOutput,
  SegmentReadOutput,
} from '../../src/api-client/generated/schemas'
import type { Region } from '../../src/api-client/generated/endpoints'

Before({ tags: '@touch' }, () =>
  Cypress.automation('remote:debugger:protocol', {
    command: 'Emulation.setTouchEmulationEnabled',
    params: { enabled: true, maxTouchPoints: 2 },
  }),
)

After({ tags: '@touch' }, () =>
  Cypress.automation('remote:debugger:protocol', {
    command: 'Emulation.setTouchEmulationEnabled',
    params: { enabled: false },
  }),
)

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
  summary: null,
  first_segment_source_key: 'a',
}
const segment: SegmentReadOutput = {
  id: 1,
  source_key: 'a',
  section_id: 1,
  sequence: 0,
  kind: 'prose',
  html_content: '<p><em>ಕನ್ನಡ</em><br>text</p>',
  summary: null,
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
          summary: null,
          description: null,
          cover_file_id: options.cover ? 99 : null,
          cover_url: options.cover ? '/api/v1/files/99' : null,
          source_pdf_file_id: null,
          source_pdf_url: null,
          series_id: null,
          series_index: null,
          series_title: null,
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
    headers: {
      'content-type': 'image/svg+xml',
      'access-control-allow-origin': new URL(Cypress.config('baseUrl')!).origin,
      'access-control-allow-credentials': 'true',
    },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="160"><rect width="100" height="160" fill="navy"/></svg>',
  })
  cy.intercept('GET', `${apiUrl()}/api/v1/books/${id}/content`, (request) => {
    const manifest: ContentManifestOutput = {
      state,
      summary: null,
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
                        summary: null,
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
                    summary: null,
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
    requestApi('DELETE', `${apiUrl()}/api/v1/books/${bookId}`)
})

function preparePublishedBook() {
  if (Cypress.expose('mode') !== 'live') {
    mockBook()
    return
  }
  requestApi('POST', `${apiUrl()}/api/v1/books`, {
    title: 'Sync book',
    language: 'kn',
  }).then((response) => {
    id = response.body.id
    liveIds.push(id)
    requestApi(
      'POST',
      `${apiUrl()}/api/v1/books/${id}/content-imports`,
      input,
    ).then((response) => {
      currentVersion = response.body.content_version
    })
  })
}

Given('a published synchronization book', preparePublishedBook)

function prepareBookWithMedia(
  pdfContent = mediaFixture.pdf,
  pdfRegions?: Region[],
  narrationAudio?: string,
) {
  if (Cypress.expose('mode') !== 'live') {
    mockBook()
    const files = [
      {
        id: 101,
        kind: 'source_pdf',
        book_id: id,
        section_id: null,
        byte_size: Cypress.Buffer.from(pdfContent, 'base64').length,
        metadata: { page_count: pdfRegions ? 3 : 1 },
        url: '/api/v1/files/101',
      },
      {
        id: 102,
        kind: 'audio_chapter',
        book_id: null,
        section_id: 1,
        byte_size: 500,
        metadata: {
          duration_ms: narrationAudio ? 20000 : 1000,
          sample_rate: 16000,
          channels: 1,
        },
        url: '/api/v1/files/102',
      },
    ]
    cy.intercept('GET', `${apiUrl()}/api/v1/books/${id}/content`, {
      body: {
        state: 'published',
        summary: null,
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
    if (pdfRegions || narrationAudio)
      cy.intercept('GET', `${apiUrl()}/api/v1/books/${id}/segments?*`, {
        body: {
          content_version: version,
          items: [
            {
              ...segment,
              regions: pdfRegions ?? [],
              page_indexes: [
                ...new Set(
                  (pdfRegions ?? []).map((region) => region.page_index),
                ),
              ],
            },
            {
              ...segment,
              id: 2,
              source_key: 'b',
              sequence: 2,
              ...(narrationAudio
                ? { narration_start_ms: 1000, narration_end_ms: 15000 }
                : {}),
            },
          ],
          next_offset: null,
        },
      })
    for (const [fileId, encoded, type] of [
      [101, pdfContent, 'application/pdf'],
      [102, narrationAudio ?? mediaFixture.audio, 'audio/mpeg'],
    ] as const) {
      const bytes = Cypress.Buffer.from(encoded, 'base64')
      cy.intercept('GET', `${apiUrl()}/api/v1/files/${fileId}`, (request) => {
        const partial =
          request.headers.range &&
          (!request.headers['if-range'] ||
            request.headers['if-range'] === '"fixture"')
        const range = /bytes=(\d+)-(\d*)/.exec(String(request.headers.range))
        const start = range ? Number(range[1]) : 0
        const end = range?.[2]
          ? Math.min(Number(range[2]), bytes.length - 1)
          : bytes.length - 1
        const body = partial ? bytes.subarray(start, end + 1) : bytes
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
            'content-length': String(body.length),
            'access-control-expose-headers':
              'ETag, Accept-Ranges, Content-Range',
            ...(partial
              ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` }
              : {}),
          },
        })
      })
    }
    return
  }
  cy.visit('/')
  cy.contains('reader@example.com').should('be.visible')

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
        credentials: 'include',
        body: form,
      })
      expect(response.status).to.equal(201)
      return (await response.json()).id as number
    }
    const pdf = await upload('source_pdf', pdfContent, 'application/pdf')
    const audio = await upload(
      'audio_chapter',
      narrationAudio ?? mediaFixture.audio,
      'audio/mpeg',
    )
    const response = await win.fetch(`${apiUrl()}/api/v1/books`, {
      method: 'POST',
      credentials: 'include',
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
      segments: input.segments.map((row, index) => ({
        ...row,
        ...(index === 0 && pdfRegions ? { regions: pdfRegions } : {}),
        ...(index === 1 && narrationAudio
          ? { narration_start_ms: 1000, narration_end_ms: 15000 }
          : {}),
      })),
    }
    const publication = await win.fetch(
      `${apiUrl()}/api/v1/books/${id}/content-imports`,
      {
        method: 'POST',
        credentials: 'include',
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

let pdfRangeBytes = 0
let initialPdfRangeBytes = 0
let pdfByteSize = 0
let textPageBeforePdfBrowse: string | undefined

function preparePdfBook() {
  pdfRangeBytes = 0
  cy.readFile('cypress/fixtures/reader-range.pdf', 'base64').then(
    (encoded: string) => {
      pdfByteSize = Cypress.Buffer.from(encoded, 'base64').length
      prepareBookWithMedia(encoded, [
        { page_index: 0, x0: 0.2, y0: 0.25, x1: 0.8, y1: 0.35 },
        { page_index: 1, x0: 0.1, y0: 0.15, x1: 0.6, y1: 0.3 },
      ])
    },
  )
  if (Cypress.expose('mode') === 'live')
    cy.intercept('GET', `${apiUrl()}/api/v1/files/*`, (request) => {
      request.on('response', (response) => {
        if (response.statusCode === 206) {
          const range = /^bytes (\d+)-(\d+)\/\d+$/.exec(
            String(response.headers['content-range']),
          )
          expect(range).not.to.equal(null)
          pdfRangeBytes += Number(
            response.headers['content-length'] ??
              Number(range![2]) - Number(range![1]) + 1,
          )
        }
      })
    })
}

Given('a synchronization book with PDF regions', preparePdfBook)

Given('a synchronization book whose PDF initially fails', () => {
  preparePdfBook()
  cy.intercept(
    { method: 'GET', url: `${apiUrl()}/api/v1/files/*`, times: 1 },
    { statusCode: 503 },
  )
})

When('I select book text with the keyboard', () => {
  cy.get('[data-reader-segment-id]').first().focus()
  cy.press(Cypress.Keyboard.Keys.ENTER)
})

function swipeReader(direction: string, fingerCount: number) {
  return cy.findByRole('region', { name: /^Reader$/ }).then(async ($reader) => {
    const window = $reader[0].ownerDocument.defaultView!
    // Chrome input coordinates are in the outer viewport; the AUT is scaled
    // inside Cypress's cross-origin iframe, whose frameElement is inaccessible.
    const tree = await Cypress.automation('remote:debugger:protocol', {
      command: 'Page.getFrameTree',
    })
    const frame = tree.frameTree.childFrames.find(
      (entry: { frame: { url: string } }) =>
        entry.frame.url === window.location.href,
    ).frame
    const owner = await Cypress.automation('remote:debugger:protocol', {
      command: 'DOM.getFrameOwner',
      params: { frameId: frame.id },
    })
    const box = await Cypress.automation('remote:debugger:protocol', {
      command: 'DOM.getBoxModel',
      params: { backendNodeId: owner.backendNodeId },
    })
    const [left, top, right] = box.model.content
    const rect = $reader[0].getBoundingClientRect()
    const scale = (right - left) / window.innerWidth
    const x = left + (rect.left + rect.width * 0.7) * scale
    const y = top + (rect.top + rect.height * 0.6) * scale
    const dx = direction === 'left' ? -120 : 120
    const sendTouches = (type: string, offset: number) =>
      Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchTouchEvent',
        params: {
          type,
          touchPoints:
            type === 'touchEnd'
              ? []
              : [
                  { id: 1, x: x + offset * scale, y, radiusX: 5, radiusY: 5 },
                  {
                    id: 2,
                    x: x + (offset + 60) * scale,
                    y,
                    radiusX: 5,
                    radiusY: 5,
                  },
                ].slice(0, fingerCount),
        },
      })

    await sendTouches('touchStart', 0)
    // Real fingers begin with small movement before committing to a direction.
    await sendTouches('touchMove', dx / 120)
    await sendTouches('touchMove', dx / 6)
    await sendTouches('touchMove', dx / 2)
    await sendTouches('touchMove', dx)
    await sendTouches('touchEnd', dx)
  })
}

When(
  'I swipe {word} with two fingers across the reader',
  (direction: string) => {
    if (direction === 'left') {
      cy.get('[data-reader-page]')
        .should('have.attr', 'aria-busy', 'false')
        .invoke('attr', 'data-reader-page')
        .then((page) => {
          textPageBeforePdfBrowse = page
        })
    }
    swipeReader(direction, 2)
  },
)

Then('only the PDF surface is open', () => {
  cy.findByRole('region', { name: 'Source PDF' }).should('be.visible')
  cy.findByRole('button', { name: 'Switch to Text' }).should('be.visible')
  cy.findByRole('article', { name: 'Book text' }).should('not.exist')
})

Then('the original text page is restored', () => {
  cy.get('[data-reader-page]').should(
    'have.attr',
    'data-reader-page',
    textPageBeforePdfBrowse,
  )
  cy.findByRole('region', { name: 'Source PDF' }).should('not.exist')
})

Then('I can retry the PDF while keeping selected text', () => {
  cy.contains('The PDF could not be displayed.').should('be.visible')
  cy.findByRole('button', { name: 'Retry PDF' }).click()
  cy.get('[data-pdf-page] canvas')
    .should('have.length', 2)
    .each(($canvas) =>
      cy.wrap($canvas).should('have.css', 'visibility', 'visible'),
    )

  cy.findByRole('button', { name: 'Switch to Text' }).click()
  cy.get('[data-reader-selected="true"]').should('exist')
  cy.get('[data-reader-segment-id]').last().focus()
  cy.press(Cypress.Keyboard.Keys.ENTER)
  cy.findByRole('button', { name: 'Switch to PDF' }).click()
  cy.get('[data-pdf-region]').should('not.exist')
  cy.contains('This text has no PDF regions.').should('be.visible')
})

When('I open the source PDF', () => {
  cy.get('[data-reader-page]')
    .invoke('attr', 'data-reader-page')
    .then((page) => {
      textPageBeforePdfBrowse = page
    })
  cy.findByRole('region', { name: /^Reader$/ }).trigger('keydown', {
    key: 'Enter',
  })
  cy.findByRole('button', { name: 'Switch to PDF' }).click()
})

Then('the selected PDF pages render through partial delivery', () => {
  cy.get('[data-pdf-page] canvas')
    .should('have.length', 2)
    .each(($canvas) =>
      cy.wrap($canvas).should('have.css', 'visibility', 'visible'),
    )
  cy.get('[data-pdf-region]').should('have.length', 2)
  cy.then(() => {
    if (Cypress.expose('mode') !== 'live') return
    expect(pdfRangeBytes).to.be.greaterThan(0).and.lessThan(pdfByteSize)
    initialPdfRangeBytes = pdfRangeBytes
    cy.log(
      `Selected-page partial responses: ${pdfRangeBytes} / ${pdfByteSize} bytes`,
    )
  })
})

When('I browse a distant physical PDF page', () => {
  cy.findByLabelText('Physical page').clear()
  cy.findByLabelText('Physical page').type('3')
  cy.findByRole('button', { name: /^Go$/ }).click()
})

Then('PDF browsing fetches more ranges without navigating text', () => {
  cy.get('[data-pdf-page="3"] canvas').should('be.visible')
  cy.get('[data-pdf-region]').should('not.exist')
  cy.then(() => {
    if (Cypress.expose('mode') !== 'live') return
    expect(pdfRangeBytes).to.be.greaterThan(initialPdfRangeBytes)
    return cy.writeFile('tmp/phase12-live-ranges.json', {
      fileBytes: pdfByteSize,
      selectedPageRangeBytes: initialPdfRangeBytes,
      afterDistantPageRangeBytes: pdfRangeBytes,
    })
  })
  cy.findByLabelText('PDF pages')
    .focus()
    .trigger('keydown', { key: 'PageDown' })
  cy.viewport(700, 800)
  cy.findByRole('article', { name: 'Book text' }).should('not.exist')
  cy.findByRole('button', { name: 'Switch to Text' }).click()
  cy.get('[data-reader-page]').should(
    'have.attr',
    'data-reader-page',
    textPageBeforePdfBrowse,
  )
  cy.get('[data-pdf-page]').should('not.exist')
  cy.findByRole('article', { name: 'Book text' }).should('be.visible')
})

Given('a slow synchronization book with a cover', () =>
  mockBook({ slow: true, cover: true }),
)

Given('a book that takes time to finish loading', () =>
  mockBook({ slowSecond: true }),
)

Given('a synchronization book whose first download fails', () =>
  mockBook({ failOnce: true }),
)
function openBookFromLibrary() {
  cy.visit('/')
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

When('I open the book from the library', () => {
  openBookFromLibrary()
})

When('I wait for the book to finish loading', () => {
  waitForBookSynchronization()
})

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

Then('I am back in the library', () => {
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

Then('I can start reading while the rest of the book loads', () => {
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
      const first = await fetch(file.url, {
        credentials: 'include',
        headers: { Range: 'bytes=0-15' },
      })
      const etag = first.headers.get('etag')!
      await first.body?.cancel()

      const matched = await fetch(file.url, {
        credentials: 'include',
        headers: { Range: 'bytes=0-15', 'If-Range': etag },
      })
      const byteLength = (await matched.arrayBuffer()).byteLength

      const stale = await fetch(file.url, {
        credentials: 'include',
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
  requestApi(`${apiUrl()}/api/v1/books/${id}/content`).then((response) => {
    requestApi({
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
  requestApi(`${apiUrl()}/api/v1/books/${id}/content`).then((response) => {
    requestApi({
      method: 'DELETE',
      url: `${apiUrl()}/api/v1/books/${id}/content`,
      headers: { 'If-Match': response.headers.etag },
    })
    requestApi(
      'POST',
      `${apiUrl()}/api/v1/books/${id}/content-imports`,
      input,
    ).then((response) => {
      currentVersion = response.body.content_version
    })
  })
})

When('English book summaries are published', () => {
  currentVersion = nextVersion
  cy.intercept(
    'GET',
    /\/api\/v1\/books\/7\/(content|sections|segments)(\?|$)/,
    (request) => {
      request.on('before:response', (response) => {
        if (response.body.items) {
          response.body.items = response.body.items.map(
            (item: SectionReadOutput | SegmentReadOutput) => ({
              ...item,
              summary: 'A passage about the journey home.',
            }),
          )
        } else {
          response.body.summary = 'A book about the journey home.'
        }
      })
    },
  )
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

Then(
  'the reader header separates navigation, settings and account details at {int} pixels',
  (width: number) => {
    cy.viewport(width, 800)

    cy.get('header').should(($header) => {
      const header = $header[0]
      const home = header.querySelector('button')!.getBoundingClientRect()
      const speed = header.querySelector(
        '[aria-label="Speaking speed controls"]',
      )!
      const settings = speed.parentElement!.getBoundingClientRect()
      const signOut = Array.from(header.querySelectorAll('button')).find(
        (button) => button.textContent === 'Sign out',
      )!
      const accountBounds = signOut.parentElement!.getBoundingClientRect()

      expect(settings.left).to.be.at.least(home.right)
      expect(settings.right).to.be.at.most(accountBounds.left)
      expect(
        header.getBoundingClientRect().right - accountBounds.right,
      ).to.be.lessThan(40)
    })
  },
)

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

Given('a book with a nested chapter', () => mockBook({ nested: true }))

Given('a public book is available in the library', () =>
  mockBook({ nested: true }),
)

When('I start reading the public book', () => {
  openBookFromLibrary()
  waitForBookSynchronization()
})

Given('a nested chapter book that takes time to finish loading', () =>
  mockBook({ nested: true, slowSecond: true }),
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

When('I move to chapter page {int}', (page: number) => {
  cy.findByRole('slider', { name: 'Chapter page' })
    .should('have.attr', 'aria-disabled', 'false')
    .should(($slider) => {
      expect(Number($slider.attr('aria-valuemax'))).to.be.at.least(page)
    })
    .then(($slider) => {
      const slider = $slider[0]
      const count = Number($slider.attr('aria-valuemax'))

      cy.wrap($slider).click(
        slider.clientLeft + ((page - 0.5) / count) * slider.clientWidth,
        slider.clientTop + slider.clientHeight / 2,
      )
    })
  cy.findByRole('article', { name: 'Book text' })
    .should('have.attr', 'data-reader-page', String(page))
    .and('have.attr', 'aria-busy', 'false')
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

When('I press the {word} arrow key', (direction: 'left' | 'right') => {
  const key = {
    left: Cypress.Keyboard.Keys.LEFT,
    right: Cypress.Keyboard.Keys.RIGHT,
  }[direction]

  cy.press(key)
})

Then('the reader keeps keyboard focus', () => {
  cy.findByRole('region', { name: /^Reader$/ })
    .should('be.focused')
    .and('have.css', 'outline-style', 'none')
})

When('I swipe left across the book text', () => {
  swipeReader('left', 1)
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
  cy.findByRole('button', { name: 'Search book' }).should('not.exist')
})

Then('book search is available', () => {
  cy.findByRole('button', { name: 'Search book' }).should('be.visible')
  cy.findByRole('searchbox').should('not.exist')
})

When('I submit a book search with Enter', () => {
  cy.findByRole('article', { name: 'Book text' }).should(
    'have.attr',
    'aria-busy',
    'false',
  )
  cy.findByRole('button', { name: 'Search book' }).click()
  cy.findByRole('searchbox', { name: 'Search book text' }).type(
    'search target{enter}',
  )
})

Then('the search modal protects the reader and shows both occurrences', () => {
  cy.findByRole('dialog', { name: 'Book search' }).should(($dialog) => {
    const rect = $dialog[0].getBoundingClientRect()
    expect(
      $dialog[0].ownerDocument
        .elementFromPoint(rect.x + rect.width / 2, rect.y + 20)
        ?.closest('[role="dialog"]'),
    ).to.equal($dialog[0])
  })
  cy.focused().should('have.attr', 'aria-label', 'Search book text')
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

Then('focus returns to the search button', () => {
  cy.focused().should('have.attr', 'aria-label', 'Search book')
  cy.findByRole('button', { name: 'Home' }).should('be.visible')
})

When('I reopen search results', () => {
  cy.findByRole('button', { name: 'Search book' }).click()
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
  cy.findByRole('dialog', { name: 'Book search' }).should('be.visible')
  cy.focused()
    .should('have.attr', 'aria-label', 'Search book text')
    .and('have.value', '')
  cy.findByRole('list', { name: 'Matching occurrences' })
    .children()
    .should('have.length', 0)

  cy.findByRole('searchbox', { name: 'Search book text' }).type('search target')
  cy.findByRole('button', { name: /^Search$/ }).click()
})

Then('the book search results are cleared', () => {
  cy.findByRole('button', { name: 'Search book' }).click()
  cy.findByRole('searchbox', { name: 'Search book text' }).should(
    'have.value',
    '',
  )
  cy.findByRole('list', { name: 'Matching occurrences' })
    .children()
    .should('have.length', 0)
})

When('I open search at maximum text size', () => {
  cy.document().then((document) => {
    document.documentElement.style.fontSize = '500%'
  })
  cy.findByRole('button', { name: 'Search book' }).scrollIntoView().click()
})

Then('the search field and actions remain usable', () => {
  cy.findByRole('searchbox', { name: 'Search book text' })
    .scrollIntoView()
    .should(($input) => {
      const rect = $input[0].getBoundingClientRect()
      expect(rect.left).to.be.at.least(0)
      expect(rect.right).to.be.at.most(
        $input[0].ownerDocument.defaultView!.innerWidth,
      )
    })
    .type('search target{enter}')
  cy.findByRole('list', { name: 'Matching occurrences' })
    .children()
    .should('have.length', 2)

  cy.findByRole('button', { name: 'Clear search' }).scrollIntoView().click()
  cy.focused().should('have.value', '')
  cy.findByRole('button', { name: 'Close search' }).scrollIntoView().click()

  cy.findByRole('dialog').should('not.exist')
  cy.focused().should('have.attr', 'aria-label', 'Search book')
  cy.document().then((document) => {
    document.documentElement.style.fontSize = ''
  })
})

let audioRangeResponses = 0

Given('a book whose narration starts after an introduction', () => {
  audioRangeResponses = 0
  cy.readFile('cypress/fixtures/narration.mp3', 'base64').then((encoded) => {
    prepareBookWithMedia(mediaFixture.pdf, undefined, encoded)
  })
  cy.intercept('GET', `${apiUrl()}/api/v1/files/*`, (request) => {
    request.on('response', (response) => {
      if (
        response.statusCode === 206 &&
        String(response.headers['content-type']).startsWith('audio/')
      )
        audioRangeResponses++
    })
  })
})

When('I play the page narration', () => {
  cy.findByRole('button', { name: 'Play' }).click()
})

Then(
  'the browser plays narration and replaces page steps with second skips',
  () => {
    cy.get('[data-reader-audio]').should(($audio) => {
      const audio = $audio[0] as HTMLAudioElement
      expect(audio.paused).to.equal(false)
      expect(audio.currentTime).to.be.greaterThan(1)
    })
    cy.get('[data-reader-page] [data-reader-source-key="b"]').should(
      'have.attr',
      'data-reader-highlighted',
      'true',
    )
    cy.findByRole('button', { name: 'Forward 5 seconds' }).should('be.visible')
    cy.findByRole('button', { name: 'Forward 1 page' }).should('not.exist')
    if (Cypress.expose('mode') === 'live')
      cy.then(() => expect(audioRangeResponses).to.be.greaterThan(0))
  },
)

When('I skip five seconds and pause narration', () => {
  cy.findByRole('button', { name: 'Forward 5 seconds' }).click()
  cy.get('[data-reader-audio]').should(($audio) =>
    expect(($audio[0] as HTMLAudioElement).currentTime).to.be.greaterThan(6),
  )
  cy.findByRole('button', { name: 'Pause' }).click()
})

When(
  'I navigate using the {word} control during narration',
  (control: string) => {
    if (control === 'contents') {
      cy.findByRole('navigation', { name: 'Table of contents' })
        .findByRole('button', { name: /^Chapter$/ })
        .click()
    } else {
      cy.findByRole('button', { name: 'Search book' }).click()
      cy.findByRole('searchbox', { name: 'Search book text' }).type(
        'text{enter}',
      )
      cy.findByRole('list', { name: 'Matching occurrences' })
        .findAllByRole('button')
        .first()
        .click()
    }
  },
)

Then('narration pauses and the page controls return', () => {
  cy.get('[data-reader-audio]').should(($audio) =>
    expect(($audio[0] as HTMLAudioElement).paused).to.equal(true),
  )
  cy.findByRole('button', { name: 'Forward 1 page' }).should('be.visible')
  cy.findByRole('button', { name: 'Play' }).should('be.visible')
})

Given('its narration file initially fails', () => {
  cy.intercept(
    { method: 'GET', url: `${apiUrl()}/api/v1/files/102`, times: 1 },
    { statusCode: 503 },
  )
})

Then('narration reports the file failure without continuing', () => {
  cy.findByRole('status').should(
    'contain.text',
    'audio file could not be loaded',
  )
  cy.findByRole('button', { name: 'Play' }).should('be.enabled')
  cy.get('[data-reader-audio]').should(($audio) =>
    expect(($audio[0] as HTMLAudioElement).paused).to.equal(true),
  )
})
