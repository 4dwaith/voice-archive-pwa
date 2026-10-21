import { useEffect, useRef, useState } from 'react'
import { saveStoredRecording } from '../data/recordingsRepository'
import {
  maximumRecordingHistory,
  type StoredAudioRecording,
} from '../models/recording'

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'saving'

const supportedAudioTypes = [
  // Prefer Opus where available, while keeping an MP4 option for Safari.
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/webm',
  'audio/ogg;codecs=opus',
]

function createRecordingId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function getMicrophoneErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone access was blocked. Allow access and try again.'
    }

    if (error.name === 'NotFoundError') {
      return 'No microphone was found on this device.'
    }
  }

  return 'The recording could not be started. Please try again.'
}

export function useAudioRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)

  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (status !== 'recording') return

    const updateElapsedTime = () => {
      setElapsedMs(Date.now() - startedAtRef.current)
    }
    updateElapsedTime()
    const intervalId = window.setInterval(updateElapsedTime, 250)

    return () => window.clearInterval(intervalId)
  }, [status])

  useEffect(
    () => () => {
      // A component unmount must also release the device-level microphone.
      const recorder = recorderRef.current
      if (recorder?.state === 'recording') {
        recorder.onstop = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }

  const startRecording = async () => {
    setErrorMessage('')

    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      setErrorMessage('Audio recording is not supported by this browser.')
      return
    }

    setStatus('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // Passing an unsupported MIME type throws, so negotiate before creating
      // the recorder and otherwise let the browser choose its native format.
      const mimeType = supportedAudioTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      )
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )

      chunksRef.current = []
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setElapsedMs(0)

      // MediaRecorder emits one or more chunks; they are joined after stop.
      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) chunksRef.current.push(data)
      }

      recorder.onerror = () => {
        setErrorMessage('Recording stopped because of a microphone error.')
      }

      recorder.onstop = async () => {
        // The final dataavailable event is delivered before this callback.
        const durationMs = Date.now() - startedAtRef.current
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        })
        if (blob.size > 0) {
          const storedRecording: StoredAudioRecording = {
            id: createRecordingId(),
            createdAt: new Date().toISOString(),
            durationMs,
            mimeType: blob.type,
            size: blob.size,
            blob,
          }
          try {
            await saveStoredRecording(storedRecording, maximumRecordingHistory)
          } catch {
            setErrorMessage(
              'The recording could not be saved. Please try again.',
            )
          }
        } else {
          setErrorMessage('No audio was captured. Please try again.')
        }

        releaseMicrophone()
        setStatus('idle')
        setElapsedMs(0)
      }

      recorder.start()
      setStatus('recording')
    } catch (error) {
      releaseMicrophone()
      setStatus('idle')
      setErrorMessage(getMicrophoneErrorMessage(error))
    }
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (recorder?.state !== 'recording') return

    // Calling stop flushes the final audio chunk and then triggers onstop,
    // where the complete Blob is persisted to Dexie.
    setStatus('saving')
    recorder.stop()
  }

  const toggleRecording = () => {
    if (status === 'recording') stopRecording()
    else if (status === 'idle') void startRecording()
  }

  return { status, elapsedMs, errorMessage, toggleRecording }
}
