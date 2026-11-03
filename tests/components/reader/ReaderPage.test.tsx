// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../src/contexts/ReaderContext'
import { ReaderPage } from '../../../src/components/atoms/ReaderPage/ReaderPage'

vi.mock(
  '../../../src/components/atoms/ReaderChapterLayout/ReaderChapterLayout',
  () => ({
    ReaderChapterLayout: () => null,
  }),
)

afterEach(cleanup)

describe('ReaderPage', () => {
  it('clamps the page to the available count', () => {
    const setCurrentPage = vi.fn()
    const context: ReaderContextValue = {
      toc: {
        selectedSectionId: null,
        isSectionExpanded: () => true,
        tocPresentation: 'shown',
        selectSection: vi.fn(),
        setSectionExpanded: vi.fn(),
        setTocPresentation: vi.fn(),
      },
      navigation: {
        pageScope: 'local',
        setPageScope: vi.fn(),
        currentPage: 3,
        pageCount: 1,
        globalPage: null,
        totalPageCount: null,
        indexedPageCount: 0,
        isPageNavigationPending: false,
        requestPageNavigation: vi.fn(),
        setCurrentPage,
        reportPageMeasurement: vi.fn(),
      },
      reader: {
        areControlsVisible: true,
        setControlsVisible: () => undefined,
        textSizePercent: 100,
        selectedSegmentId: null,
        highlightedSegmentId: null,
        selectSegment: vi.fn(),
        reportLayoutKey: () => undefined,
        reportSegmentError: vi.fn(),
      },
    }

    render(
      <ReaderContext value={context}>
        <ReaderPage segments={[]} label="A chapter" />
      </ReaderContext>,
    )

    expect(setCurrentPage).toHaveBeenCalledExactlyOnceWith(1)
  })
})
