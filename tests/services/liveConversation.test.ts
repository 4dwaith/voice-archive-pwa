// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiveConnectParameters, LiveServerMessage } from '@google/genai'
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
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  connect.mockReset()
})

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

  it('streams audio and clears queued speech on interruption and Stop', async () => {
    const media = createMedia()
    const session = { close: vi.fn(), sendRealtimeInput: vi.fn() }
    let callbacks!: LiveConnectParameters['callbacks']
    connect.mockImplementation(async (options: LiveConnectParameters) => {
      callbacks = options.callbacks
      deliverMessage(callbacks, { setupComplete: {} })
      return session
    })
    const live = createLiveConversation(async () => ({
      token: 'temporary',
      model: 'model',
    }))

    await live.start()
    media.capture.port.onmessage!({ data: new Int16Array([10, 20]).buffer })
    deliverMessage(callbacks, {
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
    })

    expect(live.getSnapshot().status).toBe('connected')
    expect(session.sendRealtimeInput).toHaveBeenCalledWith({
      audio: { data: 'CgAUAA==', mimeType: 'audio/pcm;rate=16000' },
    })
    expect(media.source.start).toHaveBeenCalled()

    deliverMessage(callbacks, { serverContent: { interrupted: true } })

    expect(media.source.stop).toHaveBeenCalledOnce()

    live.stop()
    callbacks.onclose?.({} as CloseEvent)

    expect(media.track.stop).toHaveBeenCalledOnce()
    expect(media.capture.disconnect).toHaveBeenCalledOnce()
    expect(media.context.close).toHaveBeenCalledOnce()
    expect(session.close).toHaveBeenCalledOnce()
    expect(live.getSnapshot().status).toBe('idle')
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
