import { ReaderChapterLayout } from '../../../src/components/atoms/ReaderChapterLayout/ReaderChapterLayout'
import {
  continuingReaderSegment,
  flowingReaderSegment,
  unbrokenReaderSegment,
} from '../../../src/mock-data/readerPages'
import {
  mountReaderChapterLayout,
  mountReaderPage,
  waitForChapterLayout,
  assertTextIsOnVisiblePage,
} from '../support/reader'

afterEach(() => {
  Cypress.sinon.restore()
})

describe('ReaderChapterLayout', () => {
  it('fills its parent and clips one of three known pages, including fractional widths', () => {
    mountReaderChapterLayout({ width: 360.4 })

    cy.get('[data-reader-layout-host] > div').should(($page) => {
      const page = $page[0].getBoundingClientRect()
      const parent = $page[0].parentElement!.getBoundingClientRect()

      expect(page.width).to.equal(parent.width)
      expect(page.height).to.equal(parent.height)
      expect(
        $page[0].parentElement!.getAttribute('data-layout-page-count'),
      ).to.equal('3')
    })
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="101"]',
      'First page line 8',
    )
    cy.get('[data-reader-segment-id="102"]').should(($segment) => {
      const document = $segment[0].ownerDocument
      const rect = $segment[0].getBoundingClientRect()

      expect(rect.left).to.be.greaterThan(
        document
          .querySelector('[data-reader-layout-host]')!
          .getBoundingClientRect().right,
      )
      expect(
        $segment[0].contains(
          document.elementFromPoint(rect.left + 2, rect.top + 2),
        ),
      ).to.equal(false)
    })
  })

  it('flows a paragraph with nested emphasis across three pages', () => {
    const layout = mountReaderChapterLayout({
      segments: [flowingReaderSegment],
    })

    assertTextIsOnVisiblePage('strong > em', 'word032')

    layout.updateProps({ page: 2 })

    assertTextIsOnVisiblePage('strong > em', 'word033')
    assertTextIsOnVisiblePage('strong > em', 'word064')

    layout.updateProps({ page: 3 })

    assertTextIsOnVisiblePage('strong > em', 'word065')
    assertTextIsOnVisiblePage('strong > em', 'word080')
  })

  it('preserves verse breaks across page boundaries', () => {
    const layout = mountReaderChapterLayout({
      segments: [continuingReaderSegment],
    })

    assertTextIsOnVisiblePage('strong > em', 'Continuing line 8')

    layout.updateProps({ page: 2 })

    assertTextIsOnVisiblePage('strong > em', 'Continuing line 9')
    assertTextIsOnVisiblePage('strong > em', 'Continuing line 16')

    layout.updateProps({ page: 3 })

    assertTextIsOnVisiblePage('strong > em', 'Continuing line 20')
  })

  it('wraps long unbroken text within the column width', () => {
    mountReaderChapterLayout({ segments: [unbrokenReaderSegment] })

    cy.get('[data-reader-layout-host]').should(($page) => {
      expect(Number($page.attr('data-layout-page-count'))).to.be.greaterThan(1)
    })
    cy.get('.reader-segment p').should(($paragraph) => {
      const range = $paragraph[0].ownerDocument.createRange()
      range.selectNodeContents($paragraph[0])

      for (const rect of Array.from(range.getClientRects()))
        expect(rect.width).to.be.at.most(320.5)
    })
  })

  it('reports zero for empty content', () => {
    mountReaderChapterLayout({ segments: [] })

    cy.get('[data-reader-layout-host]').should(
      'have.attr',
      'data-layout-page-count',
      '0',
    )
    cy.get('.reader-segment').should('not.exist')
  })

  it('remeasures when the parent height changes', () => {
    const layout = mountReaderChapterLayout()

    layout.updateProps({ page: 2 })

    cy.get('[data-reader-host]').should('have.css', 'height', '252px')
    cy.get('[data-reader-layout-host]').should(
      'have.attr',
      'data-layout-page-count',
      '3',
    )
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="102"]',
      'Second page line 1',
    )

    cy.get('[data-reader-host]').invoke('css', 'height', '146px')

    cy.get('[data-reader-host]').should('have.css', 'height', '146px')
    cy.get('[data-reader-layout-host]').should(
      'have.attr',
      'data-layout-page-count',
      '6',
    )
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="101"]',
      'First page line 5',
    )
  })

  it('remeasures when the text size prop changes', () => {
    const layout = mountReaderChapterLayout()

    layout.updateProps({ page: 2 })

    cy.get('[data-reader-layout-host]').should(
      'have.attr',
      'data-layout-page-count',
      '3',
    )
    cy.get('[data-reader-page-columns]').should('have.css', 'font-size', '16px')
    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="102"]',
      'Second page line 1',
    )

    layout.updateProps({ textSizePercent: 112.5 })

    cy.get('[data-reader-layout-host]').should(
      'have.attr',
      'data-layout-page-count',
      '4',
    )
    cy.get('[data-reader-page-columns]').should('have.css', 'font-size', '18px')

    assertTextIsOnVisiblePage(
      '[data-reader-segment-id="101"]',
      'First page line 8',
    )
  })

  it('remeasures when the parent width changes', () => {
    const layout = mountReaderChapterLayout({
      segments: [flowingReaderSegment],
    })

    layout.updateProps({ page: 2 })

    cy.get('[data-reader-host]').should('have.css', 'width', '360px')
    cy.get('[data-reader-layout-host]').should(
      'have.attr',
      'data-layout-page-count',
      '3',
    )
    assertTextIsOnVisiblePage('strong > em', 'word033')

    cy.get('[data-reader-host]').invoke('css', 'width', '200px')

    cy.get('[data-reader-host]').should('have.css', 'width', '200px')
    cy.get('[data-reader-layout-host]').should(
      'have.attr',
      'data-layout-page-count',
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

    const layout = mountReaderChapterLayout({
      waitForLayout: false,
      onReportPageCount: reportPageCount,
    })
    cy.wrap(null).should(() => {
      expect(finishOldLoad).to.be.a('function')
    })
    cy.get('[data-reader-layout-host]')
      .should('have.attr', 'data-layout-ready', 'false')
      .and('not.have.attr', 'data-layout-page-count')

    layout.updateProps({ textSizePercent: 112.5 })
    waitForChapterLayout()

    cy.get('[data-reader-layout-host]').should(
      'have.attr',
      'data-layout-page-count',
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

  it('reports exact canonical boundaries for the rendered chapter', () => {
    const report = cy.stub()
    const count = cy.stub()
    const segment = {
      ...continuingReaderSegment,
      html_content: continuingReaderSegment.html_content
        .replace('Continuing line 1<br>', 'ಕಾ é 😀 &amp;<br>')
        .replace('Continuing line 9', ''),
      text_content: continuingReaderSegment.text_content
        .replace('Continuing line 1\n', 'ಕಾ é 😀 &\n')
        .replace('Continuing line 9', ''),
    }
    // Eight lines per page; the second page begins with a blank line.
    const offsets = [0, 136, 270, 345]

    mountReaderPage({
      width: 360.4,
      waitForLayout: false,
      children: (
        <ReaderChapterLayout
          segments={[segment]}
          page={2}
          textSizePercent={100}
          shouldCount
          shouldMeasure
          onPageCount={count}
          onPageMeasure={report}
        />
      ),
    })

    cy.wrap(report).should('have.been.calledOnce')
    cy.then(() => {
      const result = report.firstCall.args[0]

      expect(result).to.include({ height: 212, textSizePercent: 100 })
      expect(result.width).to.be.closeTo(320.4, 0.02)
      expect(result.unmappableSegmentIds).to.deep.equal([])
      expect(result.pages).to.deep.equal(
        offsets.slice(1).map((endOffset, index) => ({
          localPage: index + 1,
          start: {
            segmentId: segment.id,
            sourceKey: segment.source_key,
            offset: offsets[index],
          },
          end: {
            segmentId: segment.id,
            sourceKey: segment.source_key,
            offset: endOffset,
          },
        })),
      )
      expect(
        count
          .getCalls()
          .map((call) => call.args[0])
          .filter((value) => value !== null),
      ).to.deep.equal([3])
    })
    cy.get('[data-reader-page-columns]').should('exist')
  })

  it('reports an unmappable segment without placeholder offsets', () => {
    const report = cy.stub()
    const segment = { ...continuingReaderSegment, text_content: 'mismatched' }

    mountReaderPage({
      waitForLayout: false,
      children: (
        <ReaderChapterLayout
          segments={[segment]}
          page={1}
          textSizePercent={100}
          shouldMeasure
          onPageMeasure={report}
        />
      ),
    })

    cy.wrap(report).should('have.been.calledOnce')
    cy.then(() => {
      const result = report.firstCall.args[0]

      expect(result.unmappableSegmentIds).to.deep.equal([segment.id])
      expect(result.pages).to.deep.equal([
        { localPage: 1, start: null, end: null },
      ])
    })
  })
})
