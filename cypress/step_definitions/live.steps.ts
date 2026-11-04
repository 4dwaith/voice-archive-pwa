import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'
import type { contentTestHarness } from '../../src/testing/contentTestHarness'
import type { SegmentReadOutput } from '../../src/api-client/generated/schemas'

type AudioEvidence = {
  stream?: MediaStream
  inputs: number
  outputs: number
  connections: number
}
let evidence: AudioEvidence

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

Given('a synthetic Live audio provider', () => {
  evidence = { inputs: 0, outputs: 0, connections: 0 }
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
        queueMicrotask(() => this.onopen?.())
      }
      send(raw: string) {
        const message = JSON.parse(raw)
        if (message.setup) {
          expect(message.setup.tools).to.equal(undefined)
          expect(message.setup.systemInstruction).to.equal(undefined)
          this.deliver({ setupComplete: {} })
        }
        if (message.realtimeInput) {
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

Given('Live provisioning fails once', () => {
  cy.intercept(
    { method: 'POST', url: '**/api/v1/live/token', times: 1 },
    { statusCode: 503 },
  )
})

When('I start Live from the library', () => {
  cy.visit('/')
  cy.window()
    .its('contentTestHarness')
    .then((harness) => (harness as typeof contentTestHarness).remove(7))
  cy.findByRole('button', { name: 'Start Live' }).click()
})

Then('Live exchanges browser audio', () => {
  cy.get('[data-live-state="connected"]').should('be.visible')
  cy.wrap(null).should(() => {
    expect(evidence.inputs).to.be.greaterThan(0)
    expect(evidence.outputs).to.be.greaterThan(0)
  })
})

When('I enter the synchronization reader during Live', () => {
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
    cy.findByRole('button', { name: 'Start Live' }).focus().click()
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
  cy.findByRole('button', { name: 'Start Live' }).should('be.visible')
  cy.wrap(null).should(() =>
    expect(
      evidence.stream
        ?.getTracks()
        .every((track) => track.readyState === 'ended'),
    ).to.equal(true),
  )
})

Then('Live reports failure and releases the microphone', () => {
  cy.findByRole('alert').should('contain.text', 'Live could not start')
  cy.wrap(null).should(() =>
    expect(evidence.stream?.getTracks()[0].readyState).to.equal('ended'),
  )
})
