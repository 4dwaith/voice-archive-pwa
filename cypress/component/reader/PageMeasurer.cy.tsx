import { useState } from 'react'
import type { ReaderSegment } from '../../../src/models/reader'
import { continuingReaderSegment } from '../../../src/mock-data/readerPages'
import { ReaderChapterLayout } from '../../../src/components/atoms/ReaderChapterLayout/ReaderChapterLayout'
import { PageMeasurer } from '../../../src/components/molecules/PageMeasurer/PageMeasurer'
import { mountReaderPage } from '../support/reader'

function MeasureChapter({
  segments,
  onVisibleReport,
}: {
  segments: ReaderSegment[]
  onVisibleReport?: React.ComponentProps<
    typeof ReaderChapterLayout
  >['onPageMeasure']
}) {
  const [layoutKey, setLayoutKey] = useState<string | null>(null)

  return (
    <div className="relative h-full w-full">
      <ReaderChapterLayout
        segments={segments}
        page={2}
        textSizePercent={100}
        shouldMeasure
        onPageMeasure={onVisibleReport}
        onLayoutKeyChange={setLayoutKey}
      />
      <div className="absolute inset-0">
        <PageMeasurer
          chapterIds={['verse']}
          chapterSegments={{ verse: segments }}
          layoutKey={layoutKey}
        />
      </div>
    </div>
  )
}

describe('PageMeasurer', () => {
  it('matches the visible layout while hidden and releases its content', () => {
    const visibleReport = cy.stub()
    const hiddenReport = cy.stub()
    const segments = [continuingReaderSegment]

    cy.document().then((document) => {
      hiddenReport.callsFake(() => {
        const measurer = document.querySelector('[data-reader-measurer]')!

        expect(
          document.defaultView!.getComputedStyle(measurer).visibility,
        ).to.equal('hidden')
      })
    })
    mountReaderPage({
      width: 360.4,
      waitForLayout: false,
      onReportPageMeasurement: hiddenReport,
      children: (
        <MeasureChapter segments={segments} onVisibleReport={visibleReport} />
      ),
    })

    cy.wrap(visibleReport).should('have.been.calledOnce')
    cy.wrap(hiddenReport).should('have.been.calledOnce')
    cy.then(() => {
      expect(hiddenReport.firstCall.args[0]).to.deep.equal({
        ...visibleReport.firstCall.args[0],
        chapterId: 'verse',
      })
    })
    cy.get('[data-reader-measurer]').should('not.exist')
    cy.get('[data-reader-page-columns]').should('have.length', 1)
  })

  it('completes an empty chapter with no pages', () => {
    const report = cy.stub()

    mountReaderPage({
      waitForLayout: false,
      onReportPageMeasurement: report,
      children: <MeasureChapter segments={[]} />,
    })

    cy.wrap(report).should('have.been.calledOnce')
    cy.then(() =>
      expect(report.firstCall.args[0]).to.deep.include({
        pages: [],
        unmappableSegmentIds: [],
      }),
    )
    cy.get('[data-reader-measurer]').should('not.exist')
  })
})
