// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiveConnectParameters, LiveServerMessage } from '@google/genai'
import { createLiveQueries } from '../../src/services/liveQueries'
import { createLiveTools } from '../../src/services/liveTools'
import { createAppStore } from '../../src/store/store'
import { createLiveConversation } from '../../src/services/liveConversation'

const { connect } = vi.hoisted(() => ({ connect: vi.fn() }))

function deliverMessage(
  callbacks: LiveConnectParameters['callbacks'],
  message: Partial<LiveServerMessage>,
) {
  callbacks.onmessage({ text: undefined, data: undefined, ...message })
}

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    live = { connect }
  },
  Modality: { AUDIO: 'AUDIO' },
  Behavior: { BLOCKING: 'BLOCKING' },
}))

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  connect.mockReset()
})

async function createResumableConversation() {
  const media = createMedia()
  connect.mockImplementation(async ({ callbacks }: LiveConnectParameters) => {
    deliverMessage(callbacks, { setupComplete: {} })
    return { close: vi.fn() }
  })
  const readToken = vi.fn(async () => ({
    token: 'fresh-credential',
    model: 'model',
  }))
  const live = createLiveConversation(readToken)
  await live.start()
  const callbacks = connect.mock.calls[0][0]
    .callbacks as LiveConnectParameters['callbacks']
  deliverMessage(callbacks, {
    sessionResumptionUpdate: { resumable: true, newHandle: 'checkpoint' },
  })
  return { live, readToken, callbacks, media }
}

function createMedia() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() }
  const stream = { getTracks: () => [track] }
  const source = {
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  }
  const context = {
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    audioWorklet: { addModule: vi.fn(async () => {}) },
    createMediaStreamSource: () => ({ connect: vi.fn() }),
    createBuffer: () => ({
      getChannelData: () => new Float32Array(2),
      duration: 0.01,
    }),
    createBufferSource: () => source,
    currentTime: 0,
    sampleRate: 16000,
  }
  const capture = {
    port: {
      close: vi.fn(),
      onmessage: null as ((event: { data: ArrayBuffer }) => void) | null,
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        return context
      }
    },
  )
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      constructor() {
        return capture
      }
    },
  )
  const getUserMedia = vi.fn(async () => stream)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  return { track, stream, source, context, capture, getUserMedia }
}

describe('Live conversation', () => {
  it.each(['stop', 'onclose', 'onerror', 'goAway'] as const)(
    'retains a checkpoint after %s until explicit Continue',
    async (reason) => {
      const { live, callbacks, readToken, media } =
        await createResumableConversation()

      if (reason === 'stop') live.stop()
      else if (reason === 'goAway')
        deliverMessage(callbacks, { goAway: { timeLeft: '10s' } })
      else callbacks[reason]?.({} as CloseEvent & ErrorEvent)

      expect(media.track.stop).toHaveBeenCalledOnce()
      expect(live.getSnapshot().canContinue).toBe(true)
      expect(connect).toHaveBeenCalledOnce()
      expect(live.getSnapshot().status).not.toBe('connected')

      await live.start()

      expect(readToken).toHaveBeenCalledTimes(2)
      expect(connect.mock.calls[1][0].config).toMatchObject({
        sessionResumption: { handle: 'checkpoint' },
        contextWindowCompression: { slidingWindow: {} },
      })
      live.stop()
    },
  )

  it('restores only checkpoint metadata after reload and supports discard', async () => {
    const { live, readToken } = await createResumableConversation()
    live.stop()

    const restored = createLiveConversation(readToken)

    expect(restored.getSnapshot().canContinue).toBe(true)
    expect(
      sessionStorage.getItem('voice-archive-live-checkpoint'),
    ).not.toContain('fresh-credential')

    restored.discard()
    await restored.start()

    expect(connect.mock.calls[1][0].config.sessionResumption).toEqual({})
    expect(sessionStorage.getItem('voice-archive-live-checkpoint')).toBeNull()
    restored.stop()
  })

  it('rejects expired checkpoints before requesting microphone access', async () => {
    const { live, media } = await createResumableConversation()
    live.stop()
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60 * 60 * 1000)

    await live.start()

    expect(media.getUserMedia).toHaveBeenCalledOnce()
    expect(live.getSnapshot()).toMatchObject({
      canContinue: false,
      error: expect.stringContaining('expired'),
    })
    expect(createLiveConversation(vi.fn()).getSnapshot().canContinue).toBe(
      false,
    )
  })

  it('does not offer an older checkpoint at a non-resumable boundary', async () => {
    const { live, callbacks } = await createResumableConversation()

    deliverMessage(callbacks, { sessionResumptionUpdate: { resumable: false } })
    live.stop()

    expect(live.getSnapshot()).toMatchObject({
      canContinue: false,
      error: null,
    })
    expect(sessionStorage.getItem('voice-archive-live-checkpoint')).toBeNull()
  })

  it('preserves a checkpoint if credential provisioning fails', async () => {
    const { live, readToken } = await createResumableConversation()
    live.stop()
    readToken.mockRejectedValueOnce(new Error('credential expired'))

    await live.start()

    expect(live.getSnapshot()).toMatchObject({
      status: 'failed',
      canContinue: true,
    })
    expect(connect).toHaveBeenCalledOnce()
  })

  it('offers a fresh start when the provider refuses continuation', async () => {
    const { live } = await createResumableConversation()
    live.stop()
    connect.mockRejectedValueOnce(new Error('invalid handle'))

    await live.start()

    expect(live.getSnapshot()).toMatchObject({
      canContinue: false,
      error: expect.stringContaining('could not continue'),
    })

    await live.start()

    expect(connect.mock.calls[2][0].config.sessionResumption).toEqual({})
    live.stop()
  })

  it('ignores old socket callbacks and Stop cancels a pending continuation', async () => {
    const { live, callbacks } = await createResumableConversation()
    live.stop()
    const pending = Promise.withResolvers<{ close: ReturnType<typeof vi.fn> }>()
    connect.mockReturnValueOnce(pending.promise)
    const continuing = live.start()
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(2))

    callbacks.onclose?.({} as CloseEvent)
    deliverMessage(callbacks, { sessionResumptionUpdate: { resumable: false } })

    expect(live.getSnapshot()).toMatchObject({
      status: 'connecting',
      canContinue: true,
    })

    live.stop()
    const session = { close: vi.fn() }
    pending.resolve(session)
    await continuing

    expect(session.close).toHaveBeenCalledOnce()
    expect(live.getSnapshot().status).toBe('idle')
  })

  it.each(['onerror', 'onclose'] as const)(
    'releases media after provider %s',
    async (eventName) => {
      const media = createMedia()
      let callbacks!: LiveConnectParameters['callbacks']
      connect.mockImplementation(async (options: LiveConnectParameters) => {
        callbacks = options.callbacks
        deliverMessage(callbacks, { setupComplete: {} })
        return { close: vi.fn() }
      })
      const live = createLiveConversation(async () => ({
        token: 'temporary',
        model: 'model',
      }))
      await live.start()

      callbacks[eventName]?.({} as ErrorEvent & CloseEvent)

      expect(media.track.stop).toHaveBeenCalledOnce()
      expect(media.context.close).toHaveBeenCalledOnce()
      expect(live.getSnapshot().status).toBe('failed')
    },
  )

  it('streams audio during a query and clears speech and pending replies on Stop', async () => {
    const media = createMedia()
    const session = {
      close: vi.fn(),
      sendRealtimeInput: vi.fn(),
      sendToolResponse: vi.fn(),
    }
    const queries = createLiveQueries(createAppStore().getState)
    const pending = Promise.withResolvers<never>()
    vi.spyOn(queries, 'getBookDownloadState').mockReturnValue(pending.promise)
    let callbacks!: LiveConnectParameters['callbacks']
    connect.mockImplementation(async (options: LiveConnectParameters) => {
      callbacks = options.callbacks
      deliverMessage(callbacks, { setupComplete: {} })
      return session
    })
    const live = createLiveConversation(
      async () => ({ token: 'temporary', model: 'model' }),
      createLiveTools(queries, vi.fn()),
    )

    await live.start()
    deliverMessage(callbacks, {
      toolCall: {
        functionCalls: [
          { id: 'slow', name: 'getBookDownloadState', args: { bookId: 7 } },
        ],
      },
    })
    await Promise.resolve()
    media.capture.port.onmessage!({ data: new Int16Array([10, 20]).buffer })
    const output = {
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/pcm;rate=24000',
                data: 'AAAAAA==',
              },
            },
          ],
        },
      },
    }
    deliverMessage(callbacks, output)

    expect(live.getSnapshot().status).toBe('connected')
    expect(session.sendRealtimeInput).toHaveBeenCalledWith({
      audio: { data: 'CgAUAA==', mimeType: 'audio/pcm;rate=16000' },
    })
    expect(media.source.start).toHaveBeenCalled()

    deliverMessage(callbacks, { serverContent: { interrupted: true } })

    expect(media.source.stop).toHaveBeenCalledOnce()

    deliverMessage(callbacks, output)
    live.quiesceAudio()
    deliverMessage(callbacks, output)
    media.capture.port.onmessage!({ data: new Int16Array([10, 20]).buffer })

    expect(media.source.stop).toHaveBeenCalledTimes(2)
    expect(media.source.start).toHaveBeenCalledTimes(2)
    expect(session.sendRealtimeInput).toHaveBeenCalledTimes(1)

    live.resumeAudio('Media rejected')

    expect(session.sendRealtimeInput).toHaveBeenLastCalledWith({
      text: expect.stringContaining('Media rejected'),
    })

    live.stop()
    callbacks.onclose?.({} as CloseEvent)

    expect(media.track.stop).toHaveBeenCalledOnce()
    expect(media.capture.disconnect).toHaveBeenCalledOnce()
    expect(media.context.close).toHaveBeenCalledOnce()
    expect(session.close).toHaveBeenCalledOnce()
    expect(live.getSnapshot().status).toBe('idle')

    pending.resolve({} as never)
    await new Promise((done) => setTimeout(done, 0))

    expect(session.sendToolResponse).not.toHaveBeenCalled()
  })

  it('releases a microphone granted after Stop', async () => {
    const media = createMedia()
    const permission = Promise.withResolvers<typeof media.stream>()
    media.getUserMedia.mockReturnValue(permission.promise)
    const readToken = vi.fn()
    const live = createLiveConversation(readToken)
    const starting = live.start()
    await vi.waitFor(() => expect(media.getUserMedia).toHaveBeenCalled())

    live.stop()
    permission.resolve(media.stream)
    await starting

    expect(media.track.stop).toHaveBeenCalledOnce()
    expect(readToken).not.toHaveBeenCalled()
    expect(live.getSnapshot().status).toBe('idle')
  })

  it('closes a late session without restarting capture', async () => {
    const media = createMedia()
    const connection = Promise.withResolvers<{
      close: ReturnType<typeof vi.fn>
    }>()
    connect.mockReturnValueOnce(connection.promise)
    const live = createLiveConversation(async () => ({
      token: 'temporary',
      model: 'model',
    }))
    const starting = live.start()
    await vi.waitFor(() => expect(connect).toHaveBeenCalledOnce())
    const callbacks = connect.mock.calls[0][0]
      .callbacks as LiveConnectParameters['callbacks']

    live.stop()
    const session = { close: vi.fn() }
    connection.resolve(session)
    deliverMessage(callbacks, { setupComplete: {} })
    await starting

    expect(session.close).toHaveBeenCalledOnce()
    expect(media.track.stop).toHaveBeenCalledOnce()
    expect(media.capture.port.onmessage).toBeNull()
    expect(live.getSnapshot().status).toBe('idle')
  })

  it('reports permission failure and permits a fresh attempt', async () => {
    const media = createMedia()
    media.getUserMedia.mockRejectedValueOnce(
      new DOMException('denied', 'NotAllowedError'),
    )
    const live = createLiveConversation(async () => ({
      token: 'temporary',
      model: 'model',
    }))

    await live.start()

    expect(live.getSnapshot()).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('Microphone unavailable'),
    })
    expect(media.context.close).toHaveBeenCalledOnce()

    connect.mockImplementation(async ({ callbacks }: LiveConnectParameters) => {
      deliverMessage(callbacks, { setupComplete: {} })
      return { close: vi.fn() }
    })
    await live.start()

    expect(live.getSnapshot().status).toBe('connected')
    live.stop()
  })

  it('releases media on a connection timeout', async () => {
    vi.useFakeTimers()
    const media = createMedia()
    connect.mockReturnValue(new Promise(() => {}))
    const live = createLiveConversation(async () => ({
      token: 'temporary',
      model: 'model',
    }))
    void live.start()

    await vi.advanceTimersByTimeAsync(30000)

    expect(media.track.stop).toHaveBeenCalledOnce()
    expect(live.getSnapshot().status).toBe('failed')
  })
})
