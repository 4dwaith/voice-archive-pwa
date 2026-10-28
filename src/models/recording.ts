// Retained for existing IndexedDB recordings; the recording feature is retired.
export type StoredAudioRecording = {
  id: string
  createdAt: string
  durationMs: number
  mimeType: string
  size: number
  blob: Blob
}
