import { createRef, type ReactNode } from 'react'
import { readerPageSegments } from '../../../src/mock-data/readerPages'
import type {
  ReaderPageMeasurement,
  ReaderLayoutMeasurement,
  ReaderSegment,
} from '../../../src/models/reader'
import {
  ReaderPageHarness,
  type ReaderPageControls,
  type ReaderPageInputs,
} from './ReaderPageHarness'

export function mountReaderPage({
  segments = readerPageSegments,
  width = 360,
  height = 252,
  pageCount = null,
  waitForLayout = true,
  onLayoutKeyChange,
  onPageMeasure,
  onReportPageMeasurement,
  children,
  layoutOnly = false,
}: {
  segments?: ReaderSegment[]
  width?: number
  height?: number
  pageCount?: number | null
  waitForLayout?: boolean
  children?: ReactNode
  layoutOnly?: boolean
  onReportPageMeasurement?: (report: ReaderPageMeasurement) => void
  onPageMeasure?: (report: ReaderLayoutMeasurement) => void
  onLayoutKeyChange?: (key: string | null) => void
} = {}) {
  const controls = createRef<ReaderPageControls>()

  cy.mount(
    <ReaderPageHarness
      segments={segments}
      width={width}
      height={height}
      pageCount={pageCount}
      ref={controls}
      layoutOnly={layoutOnly}
      onPageMeasure={onPageMeasure}
      onLayoutKeyChange={onLayoutKeyChange}
      onReportPageMeasurement={onReportPageMeasurement}
    >
      {children}
    </ReaderPageHarness>,
  )
  if (waitForLayout) {
    if (layoutOnly) waitForChapterLayout()
    else waitForReaderLayout()
  }

  return {
    updateContext(updates: Partial<ReaderPageInputs>) {
      return cy.then(() => controls.current!.updateContext(updates))
    },
  }
}

export function mountReaderChapterLayout(
  options: {
    segments?: ReaderSegment[]
    width?: number
    height?: number
    waitForLayout?: boolean
    onPageMeasure?: (report: ReaderLayoutMeasurement) => void
    onLayoutKeyChange?: (key: string | null) => void
  } = {},
) {
  const reader = mountReaderPage({ ...options, layoutOnly: true })

  return {
    updateProps({
      page,
      textSizePercent,
    }: {
      page?: number
      textSizePercent?: number
    }) {
      const updates: Partial<ReaderPageInputs> = {}
      if (page !== undefined) updates.currentPage = page
      if (textSizePercent !== undefined)
        updates.textSizePercent = textSizePercent
      return reader.updateContext(updates)
    },
  }
}

export function waitForChapterLayout() {
  return cy
    .get('[data-reader-layout-host]')
    .should('have.attr', 'data-layout-ready', 'true')
}

export function waitForReaderLayout() {
  return cy
    .get('[data-reader-host]')
    .should('have.attr', 'data-reader-layout-key')
    .and('match', /^[a-f0-9]{64}$/)
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
        .closest('[data-reader-page-window]')!
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
