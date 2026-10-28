import { useCallback, useState } from 'react'
import { Provider } from 'react-redux'
import type { ReaderSegment } from '../../../src/models/reader'
import { continuingReaderSegment } from '../../../src/mock-data/readerPages'
import { ReaderChapterLayout } from '../../../src/components/atoms/ReaderChapterLayout/ReaderChapterLayout'
import { PageMeasurer } from '../../../src/components/molecules/PageMeasurer/PageMeasurer'
import { ReaderProvider } from '../../../src/contexts/ReaderProvider'
import { useReaderChapters } from '../../../src/hooks/useReaderChapters'
import { readChapterSegments } from '../../../src/data/readerChapterRepository'
import { createAppStore } from '../../../src/store/store'
import { database } from '../../../src/data/database'
import { mountReaderPage } from '../support/reader'

function MeasureChapter({
  segments,
  onVisibleReport,
}: {
  segments: ReaderSegment[]
  onVisibleReport: React.ComponentProps<
    typeof ReaderChapterLayout
  >['onPageMeasure']
}) {
  const [layoutKey, setLayoutKey] = useState<string | null>(null)
  const { chapters } = useReaderChapters(7, 'version', layoutKey)
  const loadChapterSegments = useCallback(
    (chapterId: string) => readChapterSegments(7, 'version', chapterId),
    [],
  )

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
        {chapters && (
          <PageMeasurer
            bookId={7}
            contentVersion="version"
            {...chapters}
            loadChapterSegments={loadChapterSegments}
            layoutKey={layoutKey}
          />
        )}
      </div>
    </div>
  )
}

beforeEach(() => {
  cy.then(() => database.delete())
})
afterEach(() => {
  cy.then(() => database.delete())
})

function seedBookDatabase() {
  cy.then(async () => {
    await database.open()
    await database.content.put({
      bookId: 7,
      version: 'version',
      complete: true,
      manifest: {
        state: 'published',
        content_version: 'version',
        schema_version: 1,
        imported_at: '2026-10-28T00:00:00Z',
        source_pdf_file_id: null,
        section_count: 0,
        segment_count: 1,
        files: [],
      },
    })
    await database.segments.put({
      ...continuingReaderSegment,
      bookId: 7,
      version: 'version',
      sequence: 0,
      section_id: null,
      root_section_id: null,
      regions: [],
      page_indexes: [],
      narration_start_ms: null,
      narration_end_ms: null,
      narration_seek_ms: null,
      alignment_status: null,
      alignment_metadata: null,
    })
  })
}

describe('PageMeasurer', () => {
  it('commits the shared layout before releasing hidden content', () => {
    const visibleReport = cy.stub()
    const store = createAppStore()
    const segments = [continuingReaderSegment]

    seedBookDatabase();

    cy.document().then((document) => {
      store.subscribe(() => {
        if (store.getState().reader.measurementSave?.outcome === null) {
          const measurer = document.querySelector('[data-reader-measurer]')!

          expect(
            document.defaultView!.getComputedStyle(measurer).visibility,
          ).to.equal('hidden')
          expect(measurer.hasAttribute('inert')).to.equal(true)
          expect(measurer.getAttribute('aria-hidden')).to.equal('true')
        }
      })
    })

    mountReaderPage({
      width: 360.4,
      waitForLayout: false,
      children: (
        <Provider store={store}>
          <ReaderProvider bookId={7} contentVersion="version">
            <MeasureChapter
              segments={segments}
              onVisibleReport={visibleReport}
            />
          </ReaderProvider>
        </Provider>
      ),
    })

    cy.wrap(visibleReport).should('have.been.calledOnce')
    cy.wrap(null).should(() =>
      expect(store.getState().reader.measurementSave?.outcome).to.equal(
        'saved',
      ),
    )
    cy.get('[data-reader-measurer]').should('not.exist')
    cy.get('[data-reader-page-columns]').should('have.length', 1)
    cy.then(() => database.measurements.toArray()).then((records) => {
      expect(records).to.deep.equal([
        {
          ...visibleReport.firstCall.args[0],
          bookId: 7,
          contentVersion: 'version',
          chapterId: 'before',
        },
      ])
      expect(records[0].pages.length).to.be.greaterThan(1)
      expect(store.getState().reader.measurementSave?.outcome).to.equal('saved')
    })
  })
})
