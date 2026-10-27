import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderProgressNavigation } from '../../../src/components/atoms/ReaderProgressNavigation/ReaderProgressNavigation'

it('fills the footer with page cells and jumps directly to a clicked destination', () => {
  const requestPageNavigation = cy.stub().as('navigate')
  const context: ReaderContextValue = {
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
      reportPageCount: () => undefined,
    },
    reader: {
      textSizePercent: 100,
      selectedSegmentId: null,
      highlightedSegmentId: null,
      selectSegment: () => undefined,
      highlightSegment: () => undefined,
      reportSegmentError: () => undefined,
    },
  }

  cy.mount(
    <ReaderContext value={context}>
      <div style={{ width: 800 }}>
        <ReaderProgressNavigation />
      </div>
    </ReaderContext>,
  )

  cy.findByRole('navigation', { name: 'Page navigation' }).should(($nav) => {
    expect($nav[0].getBoundingClientRect().width).to.equal(600)
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
