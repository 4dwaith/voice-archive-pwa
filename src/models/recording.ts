export const maximumRecordingHistory = 15

export type StoredAudioRecording = {
  id: string
  createdAt: string
  durationMs: number
  mimeType: string
  size: number
  blob: Blob
}

export type AudioRecording = Omit<StoredAudioRecording, 'blob'> & {
  audioUrl: string
}
