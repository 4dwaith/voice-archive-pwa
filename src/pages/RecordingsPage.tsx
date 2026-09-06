import { useRecordings } from '../hooks/useRecordings'
import { maximumRecordingHistory } from '../models/recording'

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(1, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`
  return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} KB`
}

export function RecordingsPage() {
  const { recordings, isLoading } = useRecordings()

  return (
    <section
      className="mx-auto max-w-4xl px-5 py-8 sm:px-8"
      aria-labelledby="recordings-heading"
    >
      <div className="mb-8">
        <h2
          id="recordings-heading"
          className="text-3xl font-bold tracking-tight"
        >
          Recent recordings
        </h2>
        <p className="mt-2 text-lg leading-relaxed text-muted">
          Your newest {maximumRecordingHistory} voice snippets are kept on this
          device.
        </p>
      </div>

      {isLoading && recordings.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-xl font-semibold shadow-sm">
          Loading recordings…
        </p>
      ) : recordings.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-white p-8 text-center">
          <p className="text-2xl font-bold">No recordings yet</p>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            Use the microphone button below to make your first recording.
          </p>
        </div>
      ) : (
        <ol className="space-y-5">
          {recordings.map((recording, index) => (
            <li
              key={recording.id}
              className="rounded-2xl border-2 border-ink/10 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold">
                    Recording {recordings.length - index}
                  </h3>
                  <p className="mt-1 text-base font-medium text-muted">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(recording.createdAt))}
                  </p>
                </div>
                <p className="text-base font-semibold text-muted">
                  {formatDuration(recording.durationMs)} ·{' '}
                  {formatFileSize(recording.size)}
                </p>
              </div>
              <audio
                className="h-14 w-full"
                controls
                preload="metadata"
                src={recording.audioUrl}
              >
                Your browser does not support audio playback.
              </audio>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
