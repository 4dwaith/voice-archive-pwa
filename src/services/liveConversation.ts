import { GoogleGenAI, Modality, type Session } from '@google/genai'

type LiveSnapshot = {
  status: 'idle' | 'connecting' | 'connected' | 'failed'
  error: string | null
}

type LiveAttempt = {
  abort: AbortController
  context: AudioContext
  stream?: MediaStream
  capture?: AudioWorkletNode
  session?: Session
  sources: Set<AudioBufferSourceNode>
  nextTime: number
}

export function createLiveConversation(
  readToken: (signal: AbortSignal) => Promise<{ token: string; model: string }>,
) {
  let snapshot: LiveSnapshot = { status: 'idle', error: null }
  const listeners = new Set<() => void>()
  let current: LiveAttempt | null = null

  function publish(next: LiveSnapshot) {
    snapshot = next
    listeners.forEach((notify) => notify())
  }

  function stopOutput(attempt: NonNullable<typeof current>) {
    attempt.sources.forEach((source) => source.stop())
    attempt.sources.clear()
    attempt.nextTime = 0
  }

  function stop() {
    const attempt = current
    current = null
    if (attempt) {
      attempt.abort.abort()
      attempt.stream?.getTracks().forEach((track) => track.stop())
      if (attempt.capture) {
        attempt.capture.port.onmessage = null
        attempt.capture.port.close()
        attempt.capture.disconnect()
      }
      stopOutput(attempt)
      void attempt.context.close().catch(() => {})
      attempt.session?.close()
    }
    publish({ status: 'idle', error: null })
  }

  async function start() {
    if (current) return
    publish({ status: 'connecting', error: null })
    let attempt: LiveAttempt | undefined
    function fail(message: string) {
      if (!attempt || current === attempt) {
        stop()
        publish({ status: 'failed', error: message })
      }
    }
    const timeout = setTimeout(
      () => fail('Live did not connect. Check your connection and try again.'),
      30000,
    )
    try {
      // Resume during the button gesture, before awaiting permission or credentials.
      const context = new AudioContext({ sampleRate: 16000 })
      attempt = {
        abort: new AbortController(),
        context,
        sources: new Set(),
        nextTime: 0,
      }
      current = attempt
      const active = attempt
      active.abort.signal.addEventListener(
        'abort',
        () => clearTimeout(timeout),
        { once: true },
      )
      await context.resume()
      if (current !== active) return
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      if (current !== active) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      active.stream = stream
      stream
        .getTracks()
        .forEach((track) =>
          track.addEventListener('ended', () =>
            fail(
              'The microphone disconnected. Check the device and start Live again.',
            ),
          ),
        )
      await context.audioWorklet.addModule(
        new URL('./liveCapture.worklet.js', import.meta.url),
      )
      if (current !== active) return
      const capture = new AudioWorkletNode(context, 'live-capture')
      active.capture = capture
      context.createMediaStreamSource(stream).connect(capture)
      capture.connect(context.destination) // Processor outputs silence, never microphone feedback.
      const { token, model } = await readToken(active.abort.signal)
      if (current !== active) return
      const client = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1beta' },
      })
      const session = await client.live.connect({
        model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage(message) {
            if (current !== active) return
            if (message.setupComplete)
              publish({ status: 'connected', error: null })
            if (message.serverContent?.interrupted) stopOutput(active)
            try {
              for (const part of message.serverContent?.modelTurn?.parts ??
                []) {
                const audio = part.inlineData
                if (!audio?.data || !audio.mimeType?.startsWith('audio/pcm'))
                  continue
                const bytes = Uint8Array.from(atob(audio.data), (character) =>
                  character.charCodeAt(0),
                )
                const view = new DataView(bytes.buffer)
                const rate = Number(
                  /rate=(\d+)/.exec(audio.mimeType)?.[1] ?? 24000,
                )
                const buffer = context.createBuffer(1, bytes.length / 2, rate)
                const samples = buffer.getChannelData(0)
                for (let index = 0; index < samples.length; index++)
                  samples[index] = view.getInt16(index * 2, true) / 32768
                const source = context.createBufferSource()
                source.buffer = buffer
                source.connect(context.destination)
                active.sources.add(source)
                source.onended = () => {
                  active.sources.delete(source)
                  source.disconnect()
                }
                const time = Math.max(context.currentTime, active.nextTime)
                source.start(time)
                active.nextTime = time + buffer.duration
              }
            } catch {
              fail('Live audio could not be played. Start Live again.')
            }
          },
          onerror: () =>
            fail(
              'Live connection failed. Check your connection and try again.',
            ),
          onclose: () =>
            fail('Live disconnected. Start Live for a new conversation.'),
        },
      })
      if (current !== active) {
        session.close()
        return
      }
      active.session = session
      capture.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
        if (current !== active || snapshot.status !== 'connected') return
        try {
          const encoded = btoa(String.fromCharCode(...new Uint8Array(data)))
          session.sendRealtimeInput({
            audio: {
              data: encoded,
              mimeType: `audio/pcm;rate=${context.sampleRate}`,
            },
          })
        } catch {
          fail('Live could not send microphone audio. Start Live again.')
        }
      }
    } catch (error) {
      fail(
        error instanceof DOMException &&
          ['NotAllowedError', 'NotFoundError', 'NotReadableError'].includes(
            error.name,
          )
          ? 'Microphone unavailable. Allow microphone access and check your device, then start Live again.'
          : 'Live could not start. Check microphone access, your connection and server Gemini configuration.',
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    start,
    stop,
    getSnapshot: () => snapshot,
    subscribe(notify: () => void) {
      listeners.add(notify)
      return () => {
        listeners.delete(notify)
      }
    },
  }
}
