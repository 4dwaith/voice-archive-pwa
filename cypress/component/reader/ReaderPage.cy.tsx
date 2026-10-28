import { mountReaderPage, assertTextIsOnVisiblePage } from '../support/reader'

describe('ReaderPage', () => {
  it('reveals a focused segment on a clipped page', () => {
    const reader = mountReaderPage({ pageCount: 3 })

    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="101"]',
      'First page line 1',
    )

    reader.updateContext({ selectedSegmentId: 103 })
    cy.get('[data-reader-segment-id="103"]').focus()

    cy.get('[data-reader-page]').should('have.attr', 'data-reader-page', '3')
    cy.get('[data-reader-segment-id="103"]').should('have.focus')
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="103"]',
      'Third page line 1',
    )
  })
})
