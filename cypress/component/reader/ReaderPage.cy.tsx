import { mountReaderPage, assertTextIsOnVisiblePage } from '../support/reader'
import { readerPageSegments } from '../../../src/mock-data/readerPages'

describe('ReaderPage', () => {
  it('allows native text selection and copying', () => {
    const text = 'Native selection and copy.'
    mountReaderPage({
      pageCount: 1,
      segments: [
        {
          ...readerPageSegments[0],
          kind: 'prose',
          html_content: `<p>${text}</p>`,
          text_content: text,
        },
      ],
    })

    cy.get('[data-reader-segment-id] p').then(async ($paragraph) => {
      const paragraph = $paragraph[0]
      const document = paragraph.ownerDocument
      const window = document.defaultView!
      const range = document.createRange()
      range.selectNodeContents(paragraph)
      const rect = range.getBoundingClientRect()
      // Only locate the text with Range; Chrome itself creates the selection.
      const { result } = await Cypress.automation('remote:debugger:protocol', {
        command: 'Runtime.evaluate',
        params: {
          expression:
            'document.querySelector("iframe.aut-iframe").getBoundingClientRect().toJSON()',
          returnByValue: true,
        },
      })
      const frame = result.value
      const scale = frame.width / window.innerWidth
      const startX = frame.left + rect.left * scale
      const endX = frame.left + rect.right * scale
      const y = frame.top + (rect.top + rect.height / 2) * scale

      await Cypress.automation('remote:debugger:protocol', {
        command: 'Browser.grantPermissions',
        params: {
          origin: window.location.origin,
          permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
        },
      })
      for (const params of [
        { type: 'mousePressed', x: startX, y, button: 'left', clickCount: 1 },
        { type: 'mouseMoved', x: endX, y, button: 'left', buttons: 1 },
        { type: 'mouseReleased', x: endX, y, button: 'left', clickCount: 1 },
      ]) {
        await Cypress.automation('remote:debugger:protocol', {
          command: 'Input.dispatchMouseEvent',
          params,
        })
      }
      expect(window.getSelection()!.toString()).to.equal(text)

      await Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchKeyEvent',
        params: {
          type: 'keyDown',
          key: 'c',
          code: 'KeyC',
          modifiers: 2,
          windowsVirtualKeyCode: 67,
        },
      })
      await Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchKeyEvent',
        params: { type: 'keyUp', key: 'c', code: 'KeyC', modifiers: 2 },
      })
      expect(await window.navigator.clipboard.readText()).to.equal(text)
    })
  })

  it('reveals a focused segment on a clipped page', () => {
    const reader = mountReaderPage({ pageCount: 3 })

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
})
