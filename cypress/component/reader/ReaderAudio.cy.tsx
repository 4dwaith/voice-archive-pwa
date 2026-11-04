import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { Reader } from '../../../src/components/organisms/Reader/Reader'
import { database } from '../../../src/data/database'
import { createAppStore } from '../../../src/store/store'
import {
  setReaderAnchor,
  setControlsVisible,
  setReaderViewMode,
  selectSegment,
} from '../../../src/store/readerSlice'
import {
  readerBookContent,
  readerBookSection,
  readerBookSegment,
} from '../../../src/mock-data/readerBook'
import audioUrl from '../../fixtures/narration.mp3?url'
import { setReaderAudioPlayback } from '../../../src/store/readerAudioSlice'
import pdfUrl from '../../fixtures/reader.pdf?url'

afterEach(() => {
  cy.mount(<></>)
  cy.then(() => database.delete())
})

describe('Reader narration', () => {
  it('seeks from modal input and pauses PDF browsing without interrupting mode switches', () => {
    const store = createAppStore()
    const scope = { bookId: 91001, contentVersion: 'reader-story-1' }
    const text = Array.from(
      { length: 80 },
      (_, index) => `Narration line ${index + 1}.`,
    ).join('\n')
    let element: HTMLAudioElement
    let originalSource: string
    cy.viewport(800, 700)
    cy.then(async () => {
      await database.delete()
      await database.open()
      await database.content.put({
        ...readerBookContent,
        manifest: {
          ...readerBookContent.manifest,
          section_count: 2,
          segment_count: 2,
          source_pdf_file_id: 9,
          files: [
            {
              id: 10,
              kind: 'audio_chapter',
              book_id: null,
              section_id: 1,
              byte_size: 61000,
              url: new URL(audioUrl, window.location.href).href,
              metadata: { duration_ms: 20000, sample_rate: 16000, channels: 1 },
            },
            {
              id: 11,
              kind: 'audio_chapter',
              book_id: null,
              section_id: 2,
              byte_size: 61000,
              url: new URL(audioUrl, window.location.href).href + '?chapter=2',
              metadata: { duration_ms: 20000, sample_rate: 16000, channels: 1 },
            },
            {
              id: 9,
              kind: 'source_pdf',
              book_id: 91001,
              section_id: null,
              byte_size: 2000,
              url: new URL(pdfUrl, window.location.href).href,
              metadata: { page_count: 3 },
            },
          ],
        },
      })
      await database.sections.bulkPut([
        { ...readerBookSection, first_segment_source_key: 'first' },
        {
          ...readerBookSection,
          id: 2,
          source_key: 'second-root',
          sequence: 1,
          sibling_sequence: 1,
          first_segment_source_key: 'second',
        },
      ])
      await database.segments.bulkPut([
        {
          ...readerBookSegment,
          id: 1,
          source_key: 'first',
          section_id: 1,
          root_section_id: 1,
          kind: 'verse',
          html_content: `<p>${text.replaceAll('\n', '<br>')}</p>`,
          text_content: text,
          narration_start_ms: 0,
          narration_end_ms: 12000,
          regions: [{ page_index: 0, x0: 0.1, y0: 0.1, x1: 0.8, y1: 0.3 }],
        },
        {
          ...readerBookSegment,
          id: 2,
          sequence: 1,
          source_key: 'second',
          section_id: 2,
          root_section_id: 2,
          html_content: '<p>Second chapter narration.</p>',
          text_content: 'Second chapter narration.',
          narration_start_ms: 1000,
          narration_end_ms: 3000,
        },
      ])
    })
    cy.mount(
      <Provider store={store}>
        <MemoryRouter>
          <div style={{ width: '100%', height: 700 }}>
            <Reader {...scope} restorePosition={false} />
          </div>
        </MemoryRouter>
      </Provider>,
    )
    cy.get('[data-reader-page]').should('have.attr', 'aria-busy', 'false')
    cy.get('[data-reader-page-count]').should(($page) =>
      expect(Number($page.attr('data-reader-page-count'))).to.be.greaterThan(1),
    )
    cy.get('[data-reader-audio]').then(($audio) => {
      element = $audio[0] as HTMLAudioElement
      cy.spy(element, 'load').as('loadAudio')
    })

    cy.findByRole('button', { name: 'Play' }).click()

    cy.findByRole('dialog', { name: 'Narration' }).should('be.visible')
    cy.get('[data-reader-audio]').should(($audio) =>
      expect(($audio[0] as HTMLAudioElement).paused).to.equal(false),
    )
    cy.then(() => {
      originalSource = element.currentSrc
      element.currentTime = 8
    })
    cy.findByRole('region', { name: 'Narrated text' }).should(($text) =>
      expect($text[0].scrollTop).to.be.greaterThan(200),
    )
    cy.findByRole('button', { name: 'Back 5 seconds' }).should('be.visible')

    cy.findByRole('region', { name: 'Narrated text' })
      .should('have.css', 'overflow-y', 'hidden')
      .focus()
      .type('{pageup}')

    cy.get('[data-reader-audio]').should(() =>
      expect(element.currentTime).to.be.closeTo(3, 1),
    )
    cy.findByRole('region', { name: 'Narrated text' }).then(($text) => {
      const wheel = new WheelEvent('wheel', {
        deltaY: 120,
        bubbles: true,
        cancelable: true,
      })

      $text[0].dispatchEvent(wheel)

      expect(wheel.defaultPrevented).to.equal(true)
    })

    cy.get('[data-reader-audio]').should(() =>
      expect(element.currentTime).to.be.closeTo(8, 1),
    )
    cy.findByRole('region', { name: 'Narrated text' }).then(($text) => {
      function dispatchTouchPointer(type: string, x: number, buttons: number) {
        $text[0].dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            buttons,
            clientX: x,
            clientY: 200,
          }),
        )
      }

      dispatchTouchPointer('pointerdown', 200, 1)
      dispatchTouchPointer('pointermove', 300, 1)
      dispatchTouchPointer('pointerup', 300, 0)
    })

    cy.get('[data-reader-audio]').should(() => {
      expect(element.currentTime).to.be.closeTo(3, 1)
      expect(element.paused).to.equal(false)
    })
    cy.get('@loadAudio').should('have.been.calledOnce')
    cy.then(() => {
      element.currentTime = 8
    })

    cy.findByRole('button', { name: 'Pause' }).click()

    cy.findByRole('dialog', { name: 'Narration' }).should('not.exist')
    cy.then(() => {
      expect(element.paused).to.equal(true)
      expect(element.currentTime).to.be.closeTo(8, 1)
    })
    cy.then(() => store.dispatch(setControlsVisible(false)))
    cy.findByRole('button', { name: 'Play' }).click()
    cy.findByRole('dialog', { name: 'Narration' }).should('be.visible')
    cy.then(() =>
      expect(store.getState().reader.areControlsVisible).to.equal(false),
    )

    cy.findByRole('button', { name: 'Pause' }).click()
    cy.findByRole('dialog', { name: 'Narration' }).should('not.exist')
    cy.findByRole('button', { name: 'Play' }).should('be.focused').click()

    cy.findByRole('button', { name: 'Switch to PDF' }).click()

    cy.findByRole('dialog').should('not.exist')
    cy.findByRole('button', { name: 'Pause' }).should('not.exist')
    cy.get('[data-pdf-page] canvas').should('be.visible')
    cy.then(() => expect(element.paused).to.equal(false))

    cy.findByRole('button', { name: 'Next PDF page' }).click()

    cy.get('[data-pdf-page="2"] canvas').should('be.visible')
    cy.then(() => {
      expect(element.paused).to.equal(true)
      expect(store.getState().reader.anchor?.segmentId).to.equal(1)
    })
    cy.findByRole('button', { name: 'Switch to Text' }).click()
    cy.findByRole('button', { name: 'Play' }).click()
    cy.findByRole('button', { name: 'Switch to PDF' }).click()

    cy.then(() => {
      expect(element.paused).to.equal(false)
      expect(element.currentSrc).to.equal(originalSource)
      store.dispatch(
        setReaderAnchor({ ...scope, anchor: { segmentId: 2, offset: 0 } }),
      )
    })
    cy.then(() => {
      expect(element.currentSrc).to.equal(originalSource)
      expect(element.currentTime).to.be.greaterThan(7)
      store.dispatch(setReaderViewMode('text'))
    })
    cy.findByRole('button', { name: 'Pause' }).click()
    cy.findByRole('dialog', { name: 'Narration' }).should('not.exist')
    cy.get('[data-reader-segment-id="2"]').focus()
    cy.press(Cypress.Keyboard.Keys.ENTER)

    cy.get('[data-reader-segment-id="2"]').should(
      'have.attr',
      'data-reader-selected',
      'true',
    )
    cy.then(() =>
      store.dispatch(
        setReaderAudioPlayback({ ...scope, isPlaying: true, segmentId: 2 }),
      ),
    )
    cy.get('[data-reader-audio]').should(($audio) => {
      expect(($audio[0] as HTMLAudioElement).currentSrc).to.contain('chapter=2')
    })
    cy.get('@loadAudio').should('have.been.calledTwice')
    cy.then(() => {
      element.currentTime = 3.1
    })
    cy.get('[data-reader-audio]').should(($audio) =>
      expect(($audio[0] as HTMLAudioElement).paused).to.equal(false),
    )
    cy.then(() => {
      element.currentTime = element.duration - 0.05
    })
    cy.findByRole('button', { name: 'Play' }).should('be.visible')
    cy.findByRole('status').should('contain.text', 'No more narrated segments.')
  })

  it('plays beyond a split segment timestamp and changes chapter audio at file end', () => {
    const store = createAppStore()
    const scope = { bookId: 91001, contentVersion: 'reader-story-1' }
    const createLines = (count: number) =>
      Array.from({ length: count }, (_, index) => `Line ${index + 1}.`).join(
        '\n',
      )
    let element: HTMLAudioElement
    let pauseCount: number
    cy.viewport(800, 700)
    cy.then(async () => {
      await database.open()
      await database.content.put({
        ...readerBookContent,
        manifest: {
          ...readerBookContent.manifest,
          section_count: 2,
          segment_count: 3,
          files: [1, 2].map((id) => ({
            id,
            kind: 'audio_chapter' as const,
            book_id: null,
            section_id: id,
            byte_size: 61000,
            url: new URL(audioUrl, window.location.href).href + `?root=${id}`,
            metadata: { duration_ms: 20000, sample_rate: 16000, channels: 1 },
          })),
        },
      })
      await database.sections.bulkPut([
        { ...readerBookSection, first_segment_source_key: 'prefix' },
        {
          ...readerBookSection,
          id: 2,
          source_key: 'root-2',
          sequence: 1,
          sibling_sequence: 1,
          first_segment_source_key: 'last',
        },
      ])
      await database.segments.bulkPut([
        {
          ...readerBookSegment,
          id: 1,
          source_key: 'prefix',
          section_id: 1,
          root_section_id: 1,
          kind: 'verse',
          text_content: createLines(10),
          html_content: `<p>${createLines(10).replaceAll('\n', '<br>')}</p>`,
        },
        {
          ...readerBookSegment,
          id: 2,
          sequence: 1,
          source_key: 'short',
          section_id: 1,
          root_section_id: 1,
          kind: 'verse',
          text_content: createLines(8),
          html_content: `<p>${createLines(8).replaceAll('\n', '<br>')}</p>`,
          narration_start_ms: 0,
          narration_end_ms: 4000,
        },
        {
          ...readerBookSegment,
          id: 3,
          sequence: 2,
          source_key: 'last',
          section_id: 2,
          root_section_id: 2,
          text_content: 'Last chapter.',
          html_content: '<p>Last chapter.</p>',
          narration_start_ms: 1000,
          narration_end_ms: 3000,
        },
      ])
    })
    cy.mount(
      <Provider store={store}>
        <MemoryRouter>
          <div style={{ height: 700 }}>
            <Reader {...scope} restorePosition={false} />
          </div>
        </MemoryRouter>
      </Provider>,
    )
    cy.get('[data-reader-page]').should('have.attr', 'aria-busy', 'false')
    cy.then(() => store.dispatch(selectSegment(2)))
    cy.then(() => store.dispatch(setControlsVisible(false)))
    cy.get('[data-reader-audio]').then(($audio) => {
      element = $audio[0] as HTMLAudioElement
      cy.spy(element, 'pause').as('pauseAudio')
      cy.spy(element, 'load').as('loadAudio')
    })

    cy.findByRole('button', { name: 'Play' }).click()

    cy.findByRole('dialog', { name: 'Narration' }).should('be.visible')
    cy.findByRole('region', { name: 'Narrated text' }).should(($text) => {
      expect($text[0].scrollHeight).to.equal($text[0].clientHeight)
      expect($text[0].scrollTop).to.equal(0)
    })
    cy.get('[data-reader-audio]').should(() =>
      expect(element.paused).to.equal(false),
    )
    cy.get('@pauseAudio').then((spy) => {
      pauseCount = (spy as unknown as { callCount: number }).callCount
    })

    cy.get('[data-reader-audio]').then(($audio) => {
      ;($audio[0] as HTMLAudioElement).currentTime = 4.05
    })

    cy.get('[data-reader-audio]').should(() => {
      expect(element.paused).to.equal(false)
      expect(element.currentSrc).to.contain('root=1')
      expect(element.currentTime).to.be.greaterThan(4)
    })
    cy.get('@pauseAudio').should((spy) =>
      expect(spy).to.have.property('callCount', pauseCount),
    )
    cy.get('@loadAudio').should('have.been.calledOnce')
    cy.findByRole('dialog', { name: 'Narration' }).should('be.visible')

    cy.then(() => store.dispatch(setControlsVisible(true)))
    cy.findByRole('slider', { name: 'Chapter page' }).focus().type('{home}')

    cy.findByRole('dialog', { name: 'Narration' }).should('not.exist')
    cy.get('[data-reader-audio]').should(() => {
      expect(element.paused).to.equal(true)
      expect(store.getState().reader.selectedSegmentId).to.equal(null)
      expect(store.getState().reader.anchor?.segmentId).to.equal(1)
    })
    cy.get('[data-reader-highlighted="true"]').should('not.exist')

    cy.findByRole('button', { name: 'Play' }).click()

    cy.get('[data-reader-audio]').should(() => {
      expect(element.paused).to.equal(false)
      expect(element.currentTime).to.be.lessThan(1)
    })
    cy.get('@loadAudio').should('have.been.calledOnce')

    cy.then(() => {
      element.currentTime = element.duration - 0.05
    })

    cy.findByRole('dialog', { name: 'Narration' }).should('not.exist')
    cy.get('[data-reader-audio]').should(($audio) => {
      expect(($audio[0] as HTMLAudioElement).currentSrc).to.contain('root=2')
      expect(store.getState().reader.anchor?.segmentId).to.equal(3)
    })

    cy.then(() => database.content.delete(scope.bookId))

    cy.get('[data-reader-audio]').should(($audio) => {
      expect(($audio[0] as HTMLAudioElement).paused).to.equal(true)
      expect($audio[0].hasAttribute('src')).to.equal(false)
    })
  })
})
