import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderProgressNavigation } from '../../../src/components/atoms/ReaderProgressNavigation/ReaderProgressNavigation'

function createContextValue(
  requestPageNavigation: ReaderContextValue['navigation']['requestPageNavigation'],
): ReaderContextValue {
  return {
    toc: {
      selectedSectionId: null,
      isSectionExpanded: () => true,
      tocPresentation: 'shown',
      selectSection: () => undefined,
      setSectionExpanded: () => undefined,
      setTocPresentation: () => undefined,
    },
    navigation: {
      pageScope: 'global',
      setPageScope: () => undefined,
      currentPage: 3,
      pageCount: 6,
      globalPage: 9,
      totalPageCount: 12,
      indexedPageCount: 12,
      isPageNavigationPending: false,
      requestPageNavigation,
      setCurrentPage: () => undefined,
      reportPageMeasurement: () => undefined,
    },
    reader: {
      areControlsVisible: true,
      setControlsVisible: () => undefined,
      textSizePercent: 100,
      selectedSegmentId: null,
      highlightedSegmentId: null,
      selectSegment: () => undefined,
      reportLayoutKey: () => undefined,
      reportSegmentError: () => undefined,
    },
  }
}

describe('ReaderProgressNavigation', () => {
  let originalFontSize = ''

  beforeEach(() => {
    cy.document().then((document) => {
      originalFontSize = document.documentElement.style.fontSize
    })
  })

  afterEach(() => {
    cy.document().then((document) => {
      document.documentElement.style.fontSize = originalFontSize
    })
  })

  it('fills the footer with page cells and jumps directly to a clicked destination', () => {
    const requestPageNavigation = cy.stub().as('navigate')
    const context = createContextValue(requestPageNavigation)

    cy.mount(
      <ReaderContext value={context}>
        <div style={{ width: 800 }}>
          <ReaderProgressNavigation />
        </div>
      </ReaderContext>,
    )

    cy.findByRole('navigation', { name: 'Page navigation' }).should(($nav) => {
      expect($nav[0].getBoundingClientRect().width).to.equal(800)
    })
    cy.findByText('Tap a page segment to jump.').should(($message) => {
      const previous = $message[0].ownerDocument
        .querySelector('[aria-label="Previous pages"]')!
        .getBoundingClientRect()
      const next = $message[0].ownerDocument
        .querySelector('[aria-label="Next pages"]')!
        .getBoundingClientRect()
      const message = $message[0].getBoundingClientRect()
      expect(message.left).to.be.greaterThan(previous.right)
      expect(message.right).to.be.lessThan(next.left)
    })
    cy.findByRole('slider', { name: 'Book page' }).then(($slider) => {
      const slider = $slider[0]
      const nav = slider.closest('nav')!
      const navStyle = getComputedStyle(nav)
      expect(slider.getBoundingClientRect().width).to.equal(
        nav.clientWidth -
          parseFloat(navStyle.paddingLeft) -
          parseFloat(navStyle.paddingRight),
      )

      // Three quarters of twelve equal cells selects page ten, without dragging.
      cy.wrap($slider).click(
        slider.clientLeft + slider.clientWidth * 0.75,
        slider.clientHeight / 2,
      )
    })

    cy.get('@navigate').should('have.been.calledOnceWithExactly', {
      scope: 'global',
      kind: 'absolute',
      pageNumber: 10,
    })

    cy.findByRole('slider').then(($slider) => {
      const rect = $slider[0].getBoundingClientRect()
      const point = {
        clientX: rect.left + rect.width / 4,
        clientY: rect.top + rect.height / 2,
      }

      cy.wrap($slider)
        .trigger('pointerdown', { eventConstructor: 'PointerEvent', ...point })
        .trigger('pointermove', {
          eventConstructor: 'PointerEvent',
          ...point,
          clientX: point.clientX + 50,
        })
        .trigger('pointermove', { eventConstructor: 'PointerEvent', ...point })
        .trigger('click', { eventConstructor: 'MouseEvent', ...point })
    })

    cy.get('@navigate').should('have.been.calledOnce')
  })

  it('keeps navigation buttons compact and arrows proportional at 400% text size', () => {
    const context = createContextValue(cy.stub())

    cy.document().then((document) => {
      document.documentElement.style.fontSize = '64px'
    })
    cy.mount(
      <ReaderContext value={context}>
        <ReaderProgressNavigation />
      </ReaderContext>,
    )

    cy.findByRole('button', { name: 'Forward 25 pages' }).should(($button) => {
      const button = $button[0]
      const icon = button.querySelector('svg')!
      const label = button.querySelector('span')!
      const iconRect = icon.getBoundingClientRect()
      const labelRect = label.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      const fontSize = parseFloat(getComputedStyle(label).fontSize)

      expect(fontSize).to.equal(72)
      expect(iconRect.height).to.be.at.least(fontSize * 0.8)

      // Allow padding adjustments while rejecting oversized empty button areas.
      expect(buttonRect.height).to.be.at.most(fontSize * 2)
      expect(buttonRect.width).to.be.at.most(fontSize * 6)

      for (const content of [iconRect, labelRect]) {
        expect(content.left).to.be.at.least(buttonRect.left)
        expect(content.right).to.be.at.most(buttonRect.right)
        expect(content.top).to.be.at.least(buttonRect.top)
        expect(content.bottom).to.be.at.most(buttonRect.bottom)
      }
    })
  })
})
