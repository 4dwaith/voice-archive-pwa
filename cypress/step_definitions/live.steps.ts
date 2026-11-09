import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'
import type {
  AskResult,
  SegmentReadOutput,
} from '../../src/api-client/generated/schemas'

type AudioEvidence = {
  stream?: MediaStream
  resolvePlay?: () => void
  rejectPlay?: () => void
  toolResults: { id: string; response: Record<string, unknown> }[]
  errorInputs: string[]
  inputs: number
  outputs: number
  connections: number
  handles: (string | undefined)[]
  deliver?: (message: unknown) => void
}
let evidence: AudioEvidence
let hasCheckpoints = false

function requestLiveAction(
  name: string,
  args: Record<string, unknown> = {},
  id: string = crypto.randomUUID(),
) {
  return cy.then(() => {
    expect(evidence.deliver).to.be.a('function')
    evidence.deliver!({ toolCall: { functionCalls: [{ id, name, args }] } })
  })
}

function expectLiveInformation(id: string, field: string, expected: unknown) {
  return cy.wrap(null).should(() => {
    const response = evidence.toolResults.find(
      (call) => call.id === id,
    )?.response
    expect(Cypress._.get(response?.result, field)).to.deep.equal(expected)
  })
}

When(
  'I ask Live for summaries of the book, its chapters and the first passage',
  () => {
    requestLiveAction('getBookInfo', { bookId: 7 }, 'summary-book')
    requestLiveAction('getBookToc', { bookId: 7 }, 'summary-toc')
    requestLiveAction(
      'getSegments',
      { bookId: 7, segmentIds: [1] },
      'summary-segment',
    )
  },
)

When('I ask Live whether I have a book open', () =>
  requestLiveAction('getAppState', {}, 'library'),
)

Then('Live knows I am in the library', () =>
  expectLiveInformation('library', 'location.reader', 'unavailable'),
)

When('I ask Live which view I am using', () =>
  requestLiveAction('getAppState', {}, 'settings'),
)

Then('Live knows I am viewing the PDF', () =>
  expectLiveInformation('settings', 'settings.viewMode', 'pdf'),
)

When('I ask Live to end the conversation', () =>
  requestLiveAction('endLiveSession'),
)

When('I ask Live which books I can read', () =>
  requestLiveAction('listAvailableBooks', {}, 'catalog'),
)

Then('Live knows the book is in my library', () =>
  expectLiveInformation('catalog', 'items.0.title', 'Sync book'),
)

When('I ask Live about the book and its chapters', () => {
  requestLiveAction('getBookInfo', { bookId: 7 }, 'info')
  requestLiveAction('getBookToc', { bookId: 7 }, 'toc')
})

Then('Live knows the book has not been downloaded', () => {
  expectLiveInformation('info', 'identitySource', 'unavailable')
  expectLiveInformation('toc', 'status', 'unavailable')
})

When('I ask Live to read the current text page', () =>
  requestLiveAction('getTextPage', { offset: 0 }, 'absent'),
)

Then('Live knows there is no text page open', () =>
  expectLiveInformation('absent', 'status', 'unavailable'),
)

When('I ask Live to read the next text page without turning the page', () =>
  requestLiveAction('getTextPage', { offset: 1 }, 'adjacent'),
)

Then('Live receives the next page text', () => {
  expectLiveInformation('adjacent', 'status', 'ready')
  cy.wrap(null).should(() => {
    const result = evidence.toolResults.find(({ id }) => id === 'adjacent')
      ?.response.result
    expect(Cypress._.get(result, 'fragments.0.text')).to.be.a('string').and.not
      .be.empty
  })
})

When('I ask Live to set the text size to {float} percent', (textSize: number) =>
  requestLiveAction('updateReaderSettings', { textSize }),
)

Then('Live knows the text size is {float} percent', (size: number) => {
  requestLiveAction('getAppState', {}, 'size-read')
  expectLiveInformation('size-read', 'settings.textSizePercent', size)
})

When('I ask Live to turn to the next text page', () =>
  requestLiveAction('moveTextPage', { direction: 'next' }),
)

When('I ask Live to return to the library', () => requestLiveAction('goHome'))

When('I ask Live to open the book', () =>
  requestLiveAction('openBook', { bookId: 7 }),
)

When('I ask Live to open the nested chapter', () =>
  requestLiveAction('navigateToSection', { bookId: 7, sectionId: 2 }),
)

When('I ask Live to open the nested passage', () =>
  requestLiveAction('navigateToSegment', {
    bookId: 7,
    segmentId: 2,
    offset: 0,
  }),
)

When('I ask Live to read the first chapter aloud', () =>
  requestLiveAction('startPlayback', {
    destination: { bookId: 7, target: 'section', sectionId: 1 },
  }),
)

When(
  'I ask Live to set the speaking speed to {float} times normal',
  (playbackSpeed: number) =>
    requestLiveAction('updateReaderSettings', { playbackSpeed }),
)

When('I ask Live to hide the reading controls', () =>
  requestLiveAction('updateReaderSettings', { controlsVisible: false }),
)

When('I ask Live to show the reading controls', () =>
  requestLiveAction('updateReaderSettings', { controlsVisible: true }),
)

Then('Live receives the refreshed English summaries', () => {
  cy.wrap(null).should(() => {
    const results = Object.fromEntries(
      evidence.toolResults.map(({ id, response }) => [id, response.result]),
    ) as Record<
      string,
      {
        contentVersion?: string
        book?: { summary: string }
        sections?: { summary: string }[]
        segments?: { summary: string }[]
      }
    >
    expect(results['summary-book']?.book?.summary).to.equal(
      'A book about the journey home.',
    )
    expect(results['summary-book']?.contentVersion).to.equal(
      '1ac04088-bfcb-44e0-bcdf-ff025c93dcac',
    )
    expect(results['summary-toc']?.sections?.[0].summary).to.equal(
      'A passage about the journey home.',
    )
    expect(results['summary-segment']?.segments?.[0].summary).to.equal(
      'A passage about the journey home.',
    )
  })
})

When('I use the turner {string} gesture', (gesture: string) => {
  const key = {
    'right hold': 'MediaPlay',
    'left double tap': 'MediaTrackPrevious',
    'right double tap': 'MediaTrackNext',
  }[gesture]
  if (!key) throw new Error(`Unsupported turner gesture: ${gesture}`)

  const keyCodes: Record<string, number> = {
    MediaPlay: 179,
    MediaTrackPrevious: 177,
    MediaTrackNext: 176,
  }
  cy.window().then((win) => {
    const target = win.document.activeElement ?? win.document.body
    for (const [type, repeat] of [
      ['keydown', false],
      ['keydown', true],
      ['keyup', false],
    ] as const)
      target.dispatchEvent(
        new win.KeyboardEvent(type, {
          key,
          keyCode: keyCodes[key],
          which: keyCodes[key],
          repeat,
          bubbles: true,
          cancelable: true,
        }),
      )
  })
})

Then('turner narration is playing', () => {
  cy.findByRole('dialog', { name: 'Narration' }).should('be.visible')
  cy.get('[data-reader-audio]').should(($audio) =>
    expect(($audio[0] as HTMLAudioElement).paused).to.equal(false),
  )
})

Then('turner narration is paused', () => {
  cy.findByRole('dialog', { name: 'Narration' }).should('not.exist')
  cy.get('[data-reader-audio]').should(($audio) =>
    expect(($audio[0] as HTMLAudioElement).paused).to.equal(true),
  )
})

Then('the turner restores Text mode', () => {
  cy.findByRole('article', { name: 'Book text' }).should('be.visible')
  cy.findByRole('region', { name: 'Source PDF' }).should('not.exist')
})

Given('the conversation can be continued later', () => {
  hasCheckpoints = true
})

Given('its narrated text spans pages', () => {
  const text = 'Narrated text across several pages. '.repeat(200)
  cy.intercept('GET', '**/api/v1/books/7/segments?*', (request) => {
    request.on('before:response', (response) => {
      response.body.items = response.body.items.map(
        (segment: SegmentReadOutput) =>
          segment.id === 2
            ? { ...segment, text_content: text, html_content: `<p>${text}</p>` }
            : segment,
      )
    })
  })
})

Given('Live is available', () => {
  hasCheckpoints = false
  evidence = {
    inputs: 0,
    outputs: 0,
    connections: 0,
    handles: [],
    errorInputs: [],
    toolResults: [],
  }
  cy.intercept('POST', '**/api/v1/live/token', {
    token: 'auth_tokens/synthetic',
    model: 'gemini-3.8-live',
  })
  cy.on('window:before:load', (win) => {
    const audio = new win.AudioContext()
    const oscillator = audio.createOscillator()
    oscillator.start()
    cy.stub(win.navigator.mediaDevices, 'getUserMedia').callsFake(async () => {
      await audio.resume()
      const microphone = audio.createMediaStreamDestination()
      oscillator.connect(microphone)
      evidence.stream = microphone.stream
      return microphone.stream
    })
    const createSource = win.AudioContext.prototype.createBufferSource
    cy.stub(win.AudioContext.prototype, 'createBufferSource').callsFake(
      function (this: AudioContext) {
        evidence.outputs++
        return createSource.call(this)
      },
    )
    const NativeSocket = win.WebSocket
    class ProviderSocket {
      onopen?: () => void
      onmessage?: (event: MessageEvent) => void
      onclose?: () => void
      constructor(url: string | URL) {
        if (!String(url).includes('generativelanguage.googleapis.com'))
          return new NativeSocket(url) as unknown as ProviderSocket
        evidence.connections++
        evidence.deliver = (message) => this.deliver(message)
        queueMicrotask(() => this.onopen?.())
      }
      send(raw: string) {
        const message = JSON.parse(raw)
        if (message.setup) {
          expect(
            message.setup.tools[0].functionDeclarations.map(
              (declaration: { name: string }) => declaration.name,
            ),
          ).to.include.members([
            'ask_library',
            'getBookInfo',
            'getBookToc',
            'getSegments',
          ])
          for (const declaration of message.setup.tools[0].functionDeclarations)
            expect(declaration.behavior).to.equal('BLOCKING')
          evidence.handles.push(message.setup.sessionResumption?.handle)
          this.deliver({ setupComplete: {} })
          if (hasCheckpoints)
            this.deliver({
              sessionResumptionUpdate: {
                resumable: true,
                newHandle: 'synthetic-checkpoint',
              },
            })
        }
        if (message.toolResponse)
          evidence.toolResults.push(...message.toolResponse.functionResponses)
        if (message.realtimeInput?.text)
          evidence.errorInputs.push(message.realtimeInput.text)
        if (message.realtimeInput?.audio) {
          evidence.inputs++
          // One second of PCM output through the real browser playback path.
          if (evidence.inputs === 1)
            this.deliver({
              serverContent: {
                modelTurn: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'audio/pcm;rate=24000',
                        data: btoa('\0'.repeat(48000)),
                      },
                    },
                  ],
                },
              },
            })
        }
      }
      deliver(message: unknown) {
        this.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify(message),
          }),
        )
      }
      close() {
        this.onclose?.()
      }
    }
    win.WebSocket = ProviderSocket as unknown as typeof WebSocket
  })
})

Given('starting Live fails once', () => {
  cy.intercept(
    { method: 'POST', url: '**/api/v1/live/token', times: 1 },
    { statusCode: 503 },
  )
})

When('I start Live from the library', () => {
  cy.visit('/')
  cy.findByRole('button', { name: 'Start Live' }).click()
})

Then('I can talk with Live and hear its reply', () => {
  cy.get('[data-live-state="connected"]').should('be.visible')
  cy.wrap(null).should(() => {
    expect(evidence.inputs).to.be.greaterThan(0)
    expect(evidence.outputs).to.be.greaterThan(0)
  })
})

When('I open the book while talking with Live', () => {
  cy.findByRole('button', { name: 'Select Sync book' }).click()
})

Then('the corner Live control remains reachable', () => {
  cy.findByRole('button', { name: 'Stop Live' })
    .should('be.visible')
    .then(($button) => {
      const rect = $button[0].getBoundingClientRect()
      expect(rect.left).to.equal(8)
      expect(rect.top).to.equal(8)
      expect(
        $button[0].ownerDocument.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        ),
      ).to.satisfy((element: Element) => $button[0].contains(element))
    })
  cy.wrap(null).should(() => expect(evidence.connections).to.equal(1))
})

When('I start Live from the narration modal', () => {
  cy.findByRole('dialog', { name: 'Narration' }).within(() => {
    cy.findByRole('button', { name: /^(Start|Continue) Live$/ })
      .focus()
      .click()
  })
})

Then('narration stops and the modal closes', () => {
  cy.findByRole('dialog', { name: 'Narration' }).should('not.exist')
  cy.get('[data-reader-audio]').should(($audio) =>
    expect(($audio[0] as HTMLAudioElement).paused).to.equal(true),
  )
  cy.get('[data-live-state="connected"]').should('be.visible')
})

When('I stop Live', () =>
  cy.findByRole('button', { name: 'Stop Live' }).click(),
)
When('I retry Live', () =>
  cy.findByRole('button', { name: 'Start Live' }).click(),
)

Then('Live has released the microphone', () => {
  cy.findByRole('button', { name: /^(Start|Continue) Live$/ }).should(
    'be.visible',
  )
  cy.wrap(null).should(() =>
    expect(
      evidence.stream
        ?.getTracks()
        .every((track) => track.readyState === 'ended'),
    ).to.equal(true),
  )
})

When('I continue Live', () =>
  cy.findByRole('button', { name: 'Continue Live' }).click(),
)

When('I reload the Live app', () => cy.reload())

When('I discard the Live conversation', () =>
  cy.findByRole('button', { name: 'Discard Live conversation' }).click(),
)

When('the conversation can no longer be continued', () => {
  cy.then(() =>
    evidence.deliver?.({ sessionResumptionUpdate: { resumable: false } }),
  )
})

Then('Live resumes the same conversation', () => {
  cy.get('[data-live-state="connected"]').should('be.visible')
  cy.wrap(null).should(() =>
    expect(evidence.handles.at(-1)).to.equal('synthetic-checkpoint'),
  )
})

Then('Live waits for explicit continuation', () => {
  cy.findByRole('button', { name: 'Continue Live' }).should('be.visible')
  cy.wrap(null).should(() => expect(evidence.connections).to.equal(1))
})

Then('Live offers a fresh conversation', () => {
  cy.findByRole('button', { name: 'Start Live' }).should('be.visible')
  cy.findByRole('button', { name: 'Continue Live' }).should('not.exist')
})

Then('Live reports failure and releases the microphone', () => {
  cy.findByRole('alert').should('contain.text', 'Live could not start')
  cy.wrap(null).should(() =>
    expect(evidence.stream?.getTracks()[0].readyState).to.equal('ended'),
  )
})

Given('the narration takes time to start', () => {
  cy.on('window:before:load', (win) => {
    const play = win.HTMLMediaElement.prototype.play
    cy.stub(win.HTMLMediaElement.prototype, 'play').callsFake(function (
      this: HTMLMediaElement,
    ) {
      if (!this.matches('[data-reader-audio]')) return play.call(this)
      return new Promise<void>((resolve, reject) => {
        evidence.resolvePlay = () => {
          void play.call(this).then(resolve, reject)
        }
        evidence.rejectPlay = () =>
          reject(new win.Error('Synthetic playback rejection'))
      })
    })
  })
})

Then('Live waits silently for narration', () => {
  cy.wrap(null).should(() => {
    expect(evidence.resolvePlay).to.be.a('function')
    expect(evidence.stream?.getTracks()[0].enabled).to.equal(false)
  })
  cy.get('[data-live-state="connected"]').should('exist')
})

When('the narration starts', () => cy.then(() => evidence.resolvePlay?.()))

When('the narration cannot start', () => cy.then(() => evidence.rejectPlay?.()))

Then(
  'Live is told narration could not start and the conversation continues',
  () => {
    cy.wrap(null).should(() => {
      expect(evidence.errorInputs).to.have.length(1)
      expect(evidence.errorInputs[0]).to.contain('Synthetic playback rejection')
      expect(evidence.stream?.getTracks()[0].enabled).to.equal(true)
      expect(evidence.connections).to.equal(1)
    })
    cy.get('[data-live-state="connected"]').should('exist')
    cy.get('[data-reader-audio]').should(($audio) =>
      expect(($audio[0] as HTMLAudioElement).paused).to.equal(true),
    )
  },
)

When('I cancel delayed narration', () => {
  cy.findByRole('button', { name: 'Pause' }).click()
  cy.then(() => evidence.resolvePlay?.())
})

Then('Live continues without delayed narration', () => {
  cy.get('[data-live-state="connected"]').should('exist')
  cy.get('[data-reader-audio]').should(($audio) =>
    expect(($audio[0] as HTMLAudioElement).paused).to.equal(true),
  )
  cy.wrap(null).should(() => {
    expect(evidence.stream?.getTracks()[0].enabled).to.equal(true)
    expect(evidence.errorInputs).to.have.length(0)
  })
})

Then('the reader has keyboard focus', () => {
  cy.get('[data-reader-surface]').should('be.focused')
})

When('I tap Discard on the touchscreen', () => {
  cy.findByRole('button', { name: 'Discard Live conversation' }).then(
    async ($button) => {
      const bounds = $button[0].getBoundingClientRect()
      let x = bounds.x + bounds.width / 2
      let y = bounds.y + bounds.height / 2
      let view: Window = $button[0].ownerDocument.defaultView!
      // CDP coordinates include Cypress's containing iframe and its scale.
      while (view !== view.top) {
        const frame = (view.frameElement ??
          [...view.parent.document.querySelectorAll('iframe')].find(
            (frame) => frame.contentWindow === view,
          )) as HTMLElement
        const frameBounds = frame.getBoundingClientRect()
        const scale = frameBounds.width / frame.offsetWidth
        x = frameBounds.x + x * scale
        y = frameBounds.y + y * scale
        view = view.parent
      }
      await Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchTouchEvent',
        params: {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        },
      })
      await Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchTouchEvent',
        params: { type: 'touchEnd', touchPoints: [] },
      })
    },
  )
})

When('I focus the Live control', () => {
  cy.findByRole('button', { name: /^(Start|Continue|Stop) Live$/ }).focus()
})

Then('Live has not opened or downloaded the book', () => {
  cy.location('pathname').should('equal', '/')
  cy.get('[data-reader-surface]').should('not.exist')
  cy.get('@contentReads.all').should('have.length', 0)
})

When('I ask Live to play the selected passage', () => {
  requestLiveAction('getAppState', {}, 'selected-position')
  expectLiveInformation('selected-position', 'position.status', 'ready')

  cy.then(() => {
    const position = evidence.toolResults.find(
      ({ id }) => id === 'selected-position',
    )?.response.result as {
      position: {
        scope: { bookId: number }
        selectedSegmentId: number
      }
    }

    expect(position.position.selectedSegmentId).to.be.a('number')
    evidence.deliver?.({
      toolCall: {
        functionCalls: [
          {
            id: 'play-selected',
            name: 'startPlayback',
            args: {
              destination: {
                bookId: position.position.scope.bookId,
                target: 'segment',
                segmentId: position.position.selectedSegmentId,
              },
            },
          },
        ],
      },
    })
  })
})

Given('I have not downloaded the book', () =>
  cy
    .intercept('GET', /\/api\/v1\/books\/7\/(content|sections|segments)(\?|$)/)
    .as('contentReads'),
)

Given('the book answer is {string}', (outcome: string) => {
  const result: AskResult = {
    status: outcome === 'unavailable' ? 'unavailable' : 'answered',
    answer:
      outcome === 'unavailable'
        ? ''
        : 'The passage describes the nested destination.',
    limitations:
      outcome === 'unavailable'
        ? ['An answer is unavailable; please retry later.']
        : [],
    references:
      outcome === 'unavailable'
        ? []
        : [
            {
              book_id: 7,
              content_version:
                outcome === 'another edition'
                  ? 'b3027b66-924c-4c9a-aad5-660ba7a733bc'
                  : 'a3027b66-924c-4c9a-aad5-660ba7a733bc',
              segment_id: 2,
              section_id: 2,
              path: ['Sync book', 'Chapter', 'Nested destination'],
              sequence: 1,
              text: 'Nested destination text.',
              relevance: 'Describes the requested destination.',
            },
          ],
  }

  cy.intercept('POST', '**/api/v1/library/ask', (request) => {
    expect(request.body).to.deep.equal({
      ...(request.body.series_id === undefined
        ? { book_id: 7 }
        : { series_id: 11 }),
      query: 'What does Sync book say about the nested destination?',
      ...(outcome === 'whole book'
        ? { use_whole_book: true }
        : {
            query_en: 'What does Sync book say about the nested destination?',
            lexical_terms: ['nested destination'],
          }),
      effort: 'medium',
    })
    request.reply(result)
  }).as('bookAnswer')
})

function askLiveAboutDestination(
  scope: { bookId: number; useWholeBook?: boolean } | { seriesId: number },
) {
  cy.then(() =>
    evidence.deliver?.({
      toolCall: {
        functionCalls: [
          {
            id: 'book-question',
            name: 'ask_library',
            args: {
              ...scope,
              query: 'What does Sync book say about the nested destination?',
              ...('useWholeBook' in scope && scope.useWholeBook
                ? {}
                : {
                    queryEn:
                      'What does Sync book say about the nested destination?',
                    lexicalTerms: ['nested destination'],
                  }),
              effort: 'medium',
            },
          },
        ],
      },
    }),
  )
  cy.wait('@bookAnswer')
}

When('I ask Live about the nested destination', () => {
  askLiveAboutDestination({ bookId: 7 })
})

When('I ask Live about the nested destination across its series', () => {
  askLiveAboutDestination({ seriesId: 11 })
})

When('I ask Live to use the whole book for the question', () => {
  askLiveAboutDestination({ bookId: 7, useWholeBook: true })
})

Then('Live receives the grounded answer and supporting passage', () => {
  cy.wrap(null).should(() => {
    const result = evidence.toolResults.find(({ id }) => id === 'book-question')
      ?.response.result as AskResult

    expect(result.status).to.equal('answered')
    expect(result.answer).to.equal(
      'The passage describes the nested destination.',
    )
    expect(result.references?.[0]).to.include({
      segment_id: 2,
      text: 'Nested destination text.',
      relevance: 'Describes the requested destination.',
    })
  })
})

When('I ask Live to open the supporting passage', () => {
  cy.then(() => {
    const result = evidence.toolResults.find(({ id }) => id === 'book-question')
      ?.response.result as AskResult
    const reference = result.references![0]

    evidence.deliver?.({
      toolCall: {
        functionCalls: [
          {
            id: 'open-reference',
            name: 'navigateToSegment',
            args: {
              bookId: reference.book_id,
              segmentId: reference.segment_id,
            },
          },
        ],
      },
    })
  })
})

Then('Live receives the answer unavailability and its limitation', () => {
  cy.wrap(null).should(() => {
    const result = evidence.toolResults.find(({ id }) => id === 'book-question')
      ?.response.result as AskResult

    expect(result).to.deep.equal({
      status: 'unavailable',
      answer: '',
      limitations: ['An answer is unavailable; please retry later.'],
      references: [],
    })
  })
  cy.location('pathname').should('equal', '/')
})

Then(
  'Live can identify that the supporting passage belongs to another edition',
  () => {
    cy.wrap(null).should(() => {
      const answer = evidence.toolResults.find(
        ({ id }) => id === 'book-question',
      )?.response.result as AskResult
      const book = evidence.toolResults.find(({ id }) => id === 'info')
        ?.response.result as { contentVersion: string }

      expect(book.contentVersion).to.equal(
        'a3027b66-924c-4c9a-aad5-660ba7a733bc',
      )
      expect(answer.references![0].content_version).not.to.equal(
        book.contentVersion,
      )
    })
  },
)

Then('Live is told to open Text view first', () => {
  cy.wrap(null).should(() => {
    expect(evidence.errorInputs).to.have.length(1)
    expect(evidence.errorInputs[0]).to.contain('Open Text view')
  })
})

Then('the speaking speed is {float} times normal', (rate: number) => {
  cy.findByLabelText('Speaking speed').should(
    'have.text',
    `${rate.toFixed(2)}×`,
  )
})

When('I decrease speaking speed using the header', () => {
  cy.findByRole('button', { name: 'Speak slower' }).click()
})

Then('the reading controls are hidden', () => {
  cy.get('[data-reader-controls]').should('not.be.visible')
})

Then('the reading controls are visible', () => {
  cy.get('[data-reader-controls]').should('be.visible')
})
