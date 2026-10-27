import { createRef } from 'react'
import { readerPageSegments } from '../../../src/mock-data/readerPages'
import type { ReaderSegment } from '../../../src/models/reader'
import {
  ReaderPageHarness,
  type ReaderPageControls,
  type ReaderPageInputs,
} from './ReaderPageHarness'

export function mountReaderPage({
  segments = readerPageSegments,
  width = 360,
  height = 252,
  waitForLayout = true,
  onReportPageCount,
}: {
  segments?: ReaderSegment[]
  width?: number
  height?: number
  waitForLayout?: boolean
  onReportPageCount?: (count: number | null) => void
} = {}) {
  const controls = createRef<ReaderPageControls>()

  cy.mount(
    <ReaderPageHarness
      segments={segments}
      width={width}
      height={height}
      ref={controls}
      onReportPageCount={onReportPageCount}
    />,
  )
  if (waitForLayout) waitForReaderLayout()

  return {
    updateContext(updates: Partial<ReaderPageInputs>) {
      return cy.then(() => controls.current!.updateContext(updates))
    },
  }
}

export function waitForReaderLayout() {
  return cy
    .get('[data-reader-page]')
    .should('have.attr', 'data-reader-layout-ready', 'true')
}

export function showReaderPage(
  reader: ReturnType<typeof mountReaderPage>,
  pageNumber: number,
) {
  reader.updateContext({ currentPage: pageNumber })

  return cy
    .get('[data-reader-page]')
    .should('have.attr', 'data-reader-page', String(pageNumber))
}

// Observe actual fragments and hit testing; Cypress's visibility assertion alone
// does not prove that a CSS column has been clipped by the page window.
export function assertTextIsOnVisiblePage(
  selector: string,
  expectedText: string,
) {
  cy.get(selector).should(($elements) => {
    expect(expectedText, 'nonempty text to locate').not.to.equal('')
    const hasVisibleMatch = [...$elements].some((element) => {
      const document = element.ownerDocument
      const windowRect = element
        .closest('[data-reader-page]')!
        .querySelector('[data-reader-page-window]')!
        .getBoundingClientRect()
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)

      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? ''
        for (
          let start = text.indexOf(expectedText);
          start !== -1;
          start = text.indexOf(expectedText, start + 1)
        ) {
          const range = document.createRange()
          range.setStart(node, start)
          range.setEnd(node, start + expectedText.length)
          const fragments = Array.from(range.getClientRects()).filter(
            (rect) => rect.width > 0 && rect.height > 0,
          )

          if (
            fragments.length > 0 &&
            fragments.every(
              (rect) =>
                rect.left >= windowRect.left - 0.5 &&
                rect.right <= windowRect.right + 0.5 &&
                rect.top >= windowRect.top - 0.5 &&
                rect.bottom <= windowRect.bottom + 0.5 &&
                element.contains(
                  document.elementFromPoint(
                    (rect.left + rect.right) / 2,
                    (rect.top + rect.bottom) / 2,
                  ),
                ),
            )
          )
            return true
        }
      }
      return false
    })

    expect(
      hasVisibleMatch,
      `at least one fully visible occurrence of ${JSON.stringify(expectedText)} within ${selector}`,
    ).to.equal(true)
  })
}
