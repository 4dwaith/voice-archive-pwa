import { GoogleGenAI, Modality, type Session } from '@google/genai'
import { z } from 'zod'
import { apiBaseUrl } from '../api-client/baseApi'
import { LiveTokenResponse } from '../api-client/generated/schemas'
import { createLiveGuidance } from './liveGuidance'
import { liveToolDeclarations, type createLiveTools } from './liveTools'

const checkpointSchema = z.object({
  handle: z.string().min(1),
  model: z.string().min(1),
  expiresAt: z.number().finite(),
  effects: z.record(z.string(), z.string()).default({}),
})
const checkpointKey = 'voice-archive-live-checkpoint'
const resumptionWindow = 2 * 60 * 60 * 1000

type LiveSnapshot = {
  status: 'idle' | 'connecting' | 'connected' | 'failed'
  error: string | null
  canContinue: boolean
}

type LiveAttempt = {
  abort: AbortController
  context: AudioContext
  stream?: MediaStream
  capture?: AudioWorkletNode
  session?: Session
  sources: Set<AudioBufferSourceNode>
  nextTime: number
  isQuiesced: boolean
}

async function readLiveToken(signal: AbortSignal) {
  // Credentials never enter Redux, query caches, storage or persisted history.
  const response = await fetch(new URL('/api/v1/live/token', apiBaseUrl), {
    method: 'POST',
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error('Live provisioning failed')
  return LiveTokenResponse.parse(await response.json())
}

export function createLiveConversation(
  readToken: (
    signal: AbortSignal,
  ) => Promise<{ token: string; model: string }> = readLiveToken,
  tools?: ReturnType<typeof createLiveTools>,
) {
  let checkpoint: z.infer<typeof checkpointSchema> | null = null
  try {
    const saved = checkpointSchema.safeParse(
      JSON.parse(sessionStorage.getItem(checkpointKey) ?? 'null'),
    )
    if (saved.success && saved.data.expiresAt > Date.now())
      checkpoint = saved.data
    else sessionStorage.removeItem(checkpointKey)
  } catch {
    /* Storage may be unavailable; in-memory continuation still works. */
  }
  let snapshot: LiveSnapshot = {
    status: 'idle',
    error: null,
    canContinue: !!checkpoint,
  }
  const listeners = new Set<() => void>()
  let current: LiveAttempt | null = null

  function publish(next: Omit<LiveSnapshot, 'canContinue'>) {
    snapshot = { ...next, canContinue: !!checkpoint }
    listeners.forEach((notify) => notify())
  }

  function saveCheckpoint() {
    try {
      if (checkpoint)
        sessionStorage.setItem(checkpointKey, JSON.stringify(checkpoint))
      else sessionStorage.removeItem(checkpointKey)
    } catch {
      /* Do not interrupt audio when storage is blocked or full. */
    }
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
      if (checkpoint && snapshot.status === 'connected') {
        checkpoint.expiresAt = Date.now() + resumptionWindow
        saveCheckpoint()
      }
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
    publish({
      status: 'idle',
      error: null,
    })
  }

  function discard() {
    stop()
    checkpoint = null
    tools?.clear()
    saveCheckpoint()
    publish({ status: 'idle', error: null })
  }

  async function start() {
    if (current) return
    if (checkpoint && checkpoint.expiresAt <= Date.now()) {
      discard()
      publish({
        status: 'failed',
        error:
          'The Live checkpoint expired. Start Live for a new conversation.',
      })
      return
    }
    const previous = checkpoint
    if (!previous) tools?.clear()
    publish({ status: 'connecting', error: null })
    let attempt: LiveAttempt | undefined
    let requestedConnection = false
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
        isQuiesced: false,
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
      if (previous && previous.model !== model) {
        checkpoint = null
        saveCheckpoint()
        fail('The Live model changed. Start Live for a new conversation.')
        return
      }
      const client = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1beta' },
      })
      const effects = previous?.effects ?? {}
      const toolConnection = tools?.connect(
        active.abort.signal,
        effects,
        saveCheckpoint,
        (response) => {
          try {
            active.session?.sendToolResponse({ functionResponses: [response] })
          } catch {
            fail('Live could not send tool results. Start Live again.')
          }
        },
      )
      requestedConnection = true
      const session = await client.live.connect({
        model,
        config: {
          tools: tools
            ? [{ functionDeclarations: liveToolDeclarations }]
            : undefined,
          responseModalities: [Modality.AUDIO],
          // Explicit Start/Continue is the boundary for refreshing static help.
          systemInstruction: createLiveGuidance(),
          sessionResumption: previous ? { handle: previous.handle } : {},
          contextWindowCompression: { slidingWindow: {} },
        },
        callbacks: {
          onmessage(message) {
            if (current !== active) return
            if (message.toolCallCancellation)
              toolConnection?.cancel(message.toolCallCancellation.ids ?? [])
            for (const call of message.toolCall?.functionCalls ?? [])
              void toolConnection?.invoke(call)
            if (current !== active) return
            if (message.setupComplete)
              publish({ status: 'connected', error: null })
            if (message.sessionResumptionUpdate) {
              const update = message.sessionResumptionUpdate
              checkpoint =
                update.resumable && update.newHandle
                  ? {
                      handle: update.newHandle,
                      effects,
                      model,
                      expiresAt: Date.now() + resumptionWindow,
                    }
                  : null
              saveCheckpoint()
              publish({ status: snapshot.status, error: snapshot.error })
            }
            if (message.goAway) {
              fail(
                'Google is closing the Live connection. Choose Continue Live if available; otherwise start a new conversation.',
              )
              return
            }
            if (message.serverContent?.interrupted) stopOutput(active)
            if (active.isQuiesced) return
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
          onerror: () => handleDisconnect(),
          onclose: () => handleDisconnect(),
        },
      })
      function handleDisconnect() {
        if (current !== active) return
        if (previous && snapshot.status === 'connecting') {
          checkpoint = null
          saveCheckpoint()
          fail(
            'Live could not continue; the checkpoint may have expired or become unavailable. Start Live for a new conversation.',
          )
        } else {
          fail(
            'Live disconnected. Check your connection. Choose Continue Live if available; otherwise start a new conversation.',
          )
        }
      }
      if (current !== active) {
        session.close()
        return
      }
      active.session = session
      capture.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
        if (
          current !== active ||
          active.isQuiesced ||
          snapshot.status !== 'connected'
        )
          return
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
      if (current === attempt && previous && requestedConnection) {
        checkpoint = null
        saveCheckpoint()
        fail(
          'Live could not continue; the checkpoint may have expired or become unavailable. Start Live for a new conversation.',
        )
        return
      }
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
    discard,
    quiesceAudio() {
      if (!current) return
      current.isQuiesced = true
      current.stream?.getTracks().forEach((track) => {
        track.enabled = false
      })
      stopOutput(current)
    },
    resumeAudio(error?: string) {
      if (!current || snapshot.status !== 'connected') return
      current.isQuiesced = false
      current.stream?.getTracks().forEach((track) => {
        track.enabled = true
      })
      if (error) {
        try {
          current.session?.sendRealtimeInput({
            text: `Narration failed: ${error}. Explain this failure to the user.`,
          })
        } catch {
          stop()
          publish({
            status: 'failed',
            error:
              'Live could not receive the narration error. Start Live again.',
          })
        }
      }
    },
    getSnapshot: () => snapshot,
    subscribe(notify: () => void) {
      listeners.add(notify)
      return () => {
        listeners.delete(notify)
      }
    },
  }
}
