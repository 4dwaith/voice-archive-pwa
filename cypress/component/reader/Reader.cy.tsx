import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Reader } from '../../../src/components/organisms/Reader/Reader'
import { AppLayout } from '../../../src/layout/AppLayout'
import { createAppStore } from '../../../src/store/store'
import { database } from '../../../src/data/database'
import {
  readerBookContent,
  readerBookSegment,
} from '../../../src/mock-data/readerBook'
import { continuingReaderSegment } from '../../../src/mock-data/readerPages'
import { setReaderAnchor } from '../../../src/store/readerSlice'
import { increaseTextSize } from '../../../src/store/textSizeSlice'

beforeEach(() => {
  cy.then(() => database.delete())
})

afterEach(() => {
  cy.then(() => database.delete())
})

describe('Reader', () => {
  it('shares the fixed viewport and preserves its anchor across text reflow', () => {
    const store = createAppStore()
    // Line 15 starts inside page 2, so reflow must preserve an interior
    // reading position rather than replace it with a page-start anchor.
    const anchor = {
      segmentId: continuingReaderSegment.id,
      offset:
        continuingReaderSegment.text_content.indexOf('Continuing line 15'),
    }
    let initialKey: string
    let viewport: DOMRect

    cy.viewport(360, 252)
    cy.then(async () => {
      await database.open()
      await database.content.put(readerBookContent)
      await database.segments.put(readerBookSegment)
    })
    cy.mount(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/books/91001']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route
                path="books/:bookId"
                element={
                  <Reader bookId={91001} contentVersion="reader-story-1" />
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>,
    )
    cy.get('[data-reader-page]').should('have.attr', 'aria-busy', 'false')
    cy.then(() => {
      initialKey = store.getState().reader.layoutKey!
      store.dispatch(
        setReaderAnchor({
          bookId: 91001,
          contentVersion: 'reader-story-1',
          anchor,
        }),
      )
    })
    cy.get('[data-reader-page]').should('have.attr', 'data-reader-page', '2')
    // Capture the text window separately from the full viewport: the shared
    // renderer's padding is outside this window.
    cy.get('[data-reader-page-window]').then(($window) => {
      viewport = $window[0].getBoundingClientRect()
    })
    cy.get('main').should(($main) => {
      const rect = $main[0].getBoundingClientRect()
      expect(rect.top).to.equal(0)
      expect(rect.height).to.equal(252)
    })
    cy.get('[data-reader-overlay]').should(($overlay) => {
      expect($overlay[0].getBoundingClientRect().top).to.equal(0)
    })

    // A taller overlay must not change the rendering conditions of the text.
    cy.get('header').invoke('css', 'height', '120px')
    cy.then(() => {
      expect(store.getState().reader.layoutKey).to.equal(initialKey)
    })
    // Larger text moves the same anchor to page 3 without resizing its window.
    cy.then(() => {
      store.dispatch(increaseTextSize())
    })
    cy.get('[data-reader-page]')
      .should('have.attr', 'data-reader-page', '3')
      .and('have.attr', 'aria-busy', 'false')
    cy.get('[data-reader-page-window]').should(($window) => {
      const rect = $window[0].getBoundingClientRect()
      expect([rect.x, rect.y, rect.width, rect.height]).to.deep.equal([
        viewport.x,
        viewport.y,
        viewport.width,
        viewport.height,
      ])
      expect(store.getState().reader.layoutKey).not.to.equal(initialKey)
      expect(store.getState().reader.anchor).to.deep.equal(anchor)
    })
    // Both layouts must be committed before hidden measurement DOM is released.
    // Their saved dimensions must match the visible text window.
    cy.get('[data-reader-measurer]').should('not.exist')
    cy.then(() => database.measurements.toArray()).then((records) => {
      expect(records).to.have.length(2)
      expect(
        records.every(
          (record) =>
            record.width === viewport.width &&
            record.height === viewport.height,
        ),
      ).to.equal(true)
    })
  })
})
