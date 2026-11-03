import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { Reader } from '../../../src/components/organisms/Reader/Reader'
import { database } from '../../../src/data/database'
import { createAppStore } from '../../../src/store/store'
import {
  selectSegment,
  setReaderViewMode,
} from '../../../src/store/readerSlice'
import {
  readerBookContent,
  readerBookSegment,
} from '../../../src/mock-data/readerBook'
import pdfUrl from '../../fixtures/reader.pdf?url'

const firstRegions = [
  { page_index: 0, x0: 0.2, y0: 0.25, x1: 0.8, y1: 0.35 },
  { page_index: 0, x0: 0.1, y0: 0.5, x1: 0.4, y1: 0.6 },
  { page_index: 1, x0: 0.1, y0: 0.15, x1: 0.6, y1: 0.3 },
]

afterEach(() => {
  cy.document().then((document) => {
    document.documentElement.style.fontSize = ''
  })
  cy.then(() => database.delete())
})

describe('Reader PDF geometry', () => {
  it('aligns regions with real mixed-size rotated pages and reuses the canvas', () => {
    let canvas: HTMLCanvasElement
    const store = createAppStore()
    cy.viewport(1200, 800)
    cy.window()
      .its('Worker.prototype')
      .then((prototype) => {
        cy.spy(prototype, 'terminate').as('terminatePdfWorker')
      })
    cy.then(async () => {
      await database.delete()
      await database.open()
      await database.content.put({
        ...readerBookContent,
        manifest: {
          ...readerBookContent.manifest,
          segment_count: 3,
          source_pdf_file_id: 9,
          files: [
            {
              id: 9,
              kind: 'source_pdf',
              book_id: 91001,
              section_id: null,
              url: new URL(pdfUrl, window.location.href).href,
              byte_size: 2000,
              metadata: { page_count: 3 },
            },
          ],
        },
      })
      await database.segments.bulkPut(
        [firstRegions, firstRegions.slice(0, 1), []].map((regions, index) => ({
          ...readerBookSegment,
          id: index + 1,
          source_key: String(index),
          sequence: index,
          regions,
        })),
      )
      store.dispatch(setReaderViewMode('pdf'))
    })
    cy.mount(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/books/91001']}>
          <div style={{ width: '100%', height: 600 }}>
            <Reader bookId={91001} contentVersion={readerBookContent.version} />
          </div>
        </MemoryRouter>
      </Provider>,
    )
    cy.findByLabelText('PDF pages').should('exist')
    cy.then(() => {
      store.dispatch(selectSegment(1))
    })
    cy.location('origin').then((origin) =>
      cy
        .request(`${origin}${import.meta.env.BASE_URL}pdfjs/wasm/qcms_bg.wasm`)
        .its('headers.content-type')
        .should('include', 'application/wasm'),
    )
    cy.get('[data-pdf-page] canvas').should('have.length', 2)
    cy.get('[data-pdf-region]').should('have.length', 3)
    cy.get<HTMLCanvasElement>('[data-pdf-page="1"] canvas')
      .should('have.css', 'visibility', 'visible')
      .then(($canvas) => {
        canvas = $canvas[0]
      })
    cy.get('[data-pdf-page="2"] canvas').should(($canvas) => {
      const rect = $canvas[0].getBoundingClientRect()
      expect(rect.height / rect.width).to.be.closeTo(320 / 220, 0.01)
    })
    cy.get('[data-pdf-region]').each(($box, index) => {
      const page = $box[0].parentElement!.getBoundingClientRect()
      const box = $box[0].getBoundingClientRect()
      expect(box.left - page.left).to.be.closeTo(
        firstRegions[index].x0 * page.width,
        1,
      )
      expect(box.top - page.top).to.be.closeTo(
        firstRegions[index].y0 * page.height,
        1,
      )
      expect(box.width).to.be.closeTo(
        (firstRegions[index].x1 - firstRegions[index].x0) * page.width,
        1,
      )
    })

    cy.findByLabelText('PDF pages').should(($viewport) => {
      const frame = $viewport[0].getBoundingClientRect()
      const boxes = [...$viewport[0].querySelectorAll('[data-pdf-region]')].map(
        (box) => box.getBoundingClientRect(),
      )
      const center =
        (Math.min(...boxes.map((box) => box.top)) +
          Math.max(...boxes.map((box) => box.bottom))) /
        2
      expect(center).to.be.closeTo(frame.top + frame.height / 2, 2)
    })

    cy.then(() => {
      store.dispatch(selectSegment(2))
    })
    cy.get('[data-pdf-region]').should('have.length', 1)
    cy.get('[data-pdf-page="1"] canvas').should(($canvas) =>
      expect($canvas[0]).to.equal(canvas),
    )
    cy.findByLabelText('PDF zoom').select('1.5')
    cy.get<HTMLCanvasElement>('[data-pdf-page="1"] canvas').should(
      ($canvas) => {
        const rect = $canvas[0].getBoundingClientRect()
        expect($canvas[0].width / rect.width).to.be.closeTo(
          window.devicePixelRatio,
          0.02,
        )
      },
    )

    cy.then(() => {
      store.dispatch(selectSegment(3))
    })
    cy.get('[data-pdf-region]').should('not.exist')
    cy.contains('This text has no PDF regions.').should('be.visible')
    cy.document().then((document) => {
      document.documentElement.style.fontSize = '500%'
    })
    cy.findByRole('button', { name: 'Switch to Text' }).should('be.visible')
    cy.findByLabelText('PDF zoom').should('be.visible')
    cy.document().then((document) => {
      document.documentElement.style.fontSize = ''
    })
    cy.viewport(700, 800)
    cy.findByRole('button', { name: 'Switch to Text' })
      .should('be.visible')
      .click()
    cy.get('@terminatePdfWorker').should('have.been.called')
    cy.viewport(1200, 800)
    cy.findByRole('button', { name: 'Switch to PDF' }).should('be.visible')
  })
})
