import {
  continuingReaderSegment,
  flowingReaderSegment,
  unbrokenReaderSegment,
} from '../../../src/mock-data/readerPages'
import {
  mountReaderPage,
  waitForReaderLayout,
  showReaderPage,
  assertTextIsOnVisiblePage,
} from '../support/reader'

afterEach(() => {
  Cypress.sinon.restore()
})

describe('ReaderPage', () => {
  it('fills its parent and clips one of three known pages, including fractional widths', () => {
    mountReaderPage({ width: 360.4 })

    cy.get('[data-reader-page]').should(($page) => {
      const page = $page[0].getBoundingClientRect()
      const parent = $page[0].parentElement!.getBoundingClientRect()

      expect(page.width).to.equal(parent.width)
      expect(page.height).to.equal(parent.height)
      expect($page.attr('data-reader-page-count')).to.equal('3')
    })
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="101"]',
      'First page line 8',
    )
    cy.get('[data-reader-segment-id="102"]').should(($segment) => {
      const document = $segment[0].ownerDocument
      const rect = $segment[0].getBoundingClientRect()

      expect(rect.left).to.be.greaterThan(
        document.querySelector('[data-reader-page]')!.getBoundingClientRect()
          .right,
      )
      expect(
        $segment[0].contains(
          document.elementFromPoint(rect.left + 2, rect.top + 2),
        ),
      ).to.equal(false)
    })
  })

  it('flows a paragraph with nested emphasis across three pages', () => {
    const reader = mountReaderPage({ segments: [flowingReaderSegment] })

    assertTextIsOnVisiblePage('strong > em', 'word032')

    showReaderPage(reader, 2)

    assertTextIsOnVisiblePage('strong > em', 'word033')
    assertTextIsOnVisiblePage('strong > em', 'word064')

    showReaderPage(reader, 3)

    assertTextIsOnVisiblePage('strong > em', 'word065')
    assertTextIsOnVisiblePage('strong > em', 'word080')
  })

  it('preserves verse breaks across page boundaries', () => {
    const reader = mountReaderPage({ segments: [continuingReaderSegment] })

    assertTextIsOnVisiblePage('strong > em', 'Continuing line 8')

    showReaderPage(reader, 2)

    assertTextIsOnVisiblePage('strong > em', 'Continuing line 9')
    assertTextIsOnVisiblePage('strong > em', 'Continuing line 16')

    showReaderPage(reader, 3)

    assertTextIsOnVisiblePage('strong > em', 'Continuing line 20')
  })

  it('wraps long unbroken text within the column width', () => {
    mountReaderPage({ segments: [unbrokenReaderSegment] })

    cy.get('[data-reader-page]').should(($page) => {
      expect(Number($page.attr('data-reader-page-count'))).to.be.greaterThan(1)
    })
    cy.get('.reader-segment p').should(($paragraph) => {
      const range = $paragraph[0].ownerDocument.createRange()
      range.selectNodeContents($paragraph[0])

      for (const rect of Array.from(range.getClientRects()))
        expect(rect.width).to.be.at.most(320.5)
    })
  })

  it('reports zero for empty content', () => {
    mountReaderPage({ segments: [] })

    cy.get('[data-reader-page]').should(
      'have.attr',
      'data-reader-page-count',
      '0',
    )
    cy.get('.reader-segment').should('not.exist')
  })

  it('clamps the displayed page when a larger viewport reduces the count', () => {
    const reader = mountReaderPage()

    showReaderPage(reader, 3)

    cy.get('[data-reader-page]').should(
      'have.attr',
      'data-reader-page-count',
      '3',
    )
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="103"]',
      'Third page line 1',
    )

    cy.get('[data-reader-host]').invoke('css', 'height', '674px')

    cy.get('[data-reader-page]')
      .should('have.attr', 'data-reader-page-count', '1')
      .and('have.attr', 'data-reader-page', '1')
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="101"]',
      'First page line 1',
    )
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="103"]',
      'Third page line 8',
    )
  })

  it('reveals a focused segment on a clipped page', () => {
    const reader = mountReaderPage()

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

  it('remeasures when the parent height changes', () => {
    const reader = mountReaderPage()

    showReaderPage(reader, 2)

    cy.get('[data-reader-host]').should('have.css', 'height', '252px')
    cy.get('[data-reader-page]').should(
      'have.attr',
      'data-reader-page-count',
      '3',
    )
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="102"]',
      'Second page line 1',
    )

    cy.get('[data-reader-host]').invoke('css', 'height', '146px')

    cy.get('[data-reader-host]').should('have.css', 'height', '146px')
    cy.get('[data-reader-page]').should(
      'have.attr',
      'data-reader-page-count',
      '6',
    )
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="101"]',
      'First page line 5',
    )
  })

  it('remeasures when the context text size changes', () => {
    const reader = mountReaderPage()

    showReaderPage(reader, 2)

    cy.get('[data-reader-page]')
      .should('have.css', 'font-size', '16px')
      .and('have.attr', 'data-reader-page-count', '3')
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="102"]',
      'Second page line 1',
    )

    reader.updateContext({ textSizePercent: 112.5 })

    cy.get('[data-reader-page]')
      .should('have.css', 'font-size', '18px')
      .and('have.attr', 'data-reader-page-count', '4')

    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="101"]',
      'First page line 8',
    )
  })

  it('remeasures when the parent width changes', () => {
    const reader = mountReaderPage({ segments: [flowingReaderSegment] })

    showReaderPage(reader, 2)

    cy.get('[data-reader-host]').should('have.css', 'width', '360px')
    cy.get('[data-reader-page]').should(
      'have.attr',
      'data-reader-page-count',
      '3',
    )
    assertTextIsOnVisiblePage('strong > em', 'word033')

    cy.get('[data-reader-host]').invoke('css', 'width', '200px')

    cy.get('[data-reader-host]').should('have.css', 'width', '200px')
    cy.get('[data-reader-page]').should(
      'have.attr',
      'data-reader-page-count',
      '5',
    )

    assertTextIsOnVisiblePage('strong > em', 'word017')
  })

  it('does not publish a count from a cancelled measurement', () => {
    let finishOldLoad: () => void
    const reportPageCount = cy.stub()

    cy.document().then((document) => {
      const load = document.fonts.load.bind(document.fonts)
      const stub = Cypress.sinon.stub(document.fonts, 'load').callsFake(load)
      stub.onFirstCall().callsFake(
        () =>
          new Promise<FontFace[]>((resolve) => {
            finishOldLoad = () => resolve([])
          }),
      )
    })

    const reader = mountReaderPage({
      waitForLayout: false,
      onReportPageCount: reportPageCount,
    })
    cy.wrap(null).should(() => {
      expect(finishOldLoad).to.be.a('function')
    })
    cy.get('[data-reader-page]')
      .should('have.attr', 'aria-busy', 'true')
      .and('not.have.attr', 'data-reader-page-count')

    reader.updateContext({ textSizePercent: 112.5 })
    waitForReaderLayout()

    cy.get('[data-reader-page]').should(
      'have.attr',
      'data-reader-page-count',
      '4',
    )

    cy.then(() => {
      finishOldLoad()
    })
    cy.window().then(
      (window) =>
        new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve())
        }),
    )

    cy.then(() => {
      const completedCounts = reportPageCount
        .getCalls()
        .map((call) => call.args[0])
        .filter((count) => count !== null)

      expect(completedCounts).to.deep.equal([4])
    })
  })
})
