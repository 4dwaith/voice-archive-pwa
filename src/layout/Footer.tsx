import { NavLink } from 'react-router'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useRecordingCount } from '../hooks/useRecordings'

function formatElapsedTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const navigationClassName = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 min-w-24 items-center justify-center gap-2 justify-self-end rounded-xl px-3 py-2 text-base font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-page'
  }`

export function Footer() {
  const recordingCount = useRecordingCount()
  const { status, elapsedMs, errorMessage, toggleRecording } =
    useAudioRecorder()
  const isRecording = status === 'recording'
  const isBusy = status === 'requesting' || status === 'saving'
  const buttonLabel = isRecording
    ? `Stop recording, ${formatElapsedTime(elapsedMs)}`
    : status === 'requesting'
      ? 'Waiting for microphone permission'
      : status === 'saving'
        ? 'Saving recording'
        : 'Start recording'

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink/15 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(24,32,48,0.1)] backdrop-blur">
      {errorMessage && (
        <p
          className="border-b border-ink/10 bg-[#fff2d7] px-4 py-2 text-center text-base font-semibold text-ink"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      <div className="mx-auto grid max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3 sm:px-6">
        <span aria-hidden="true" />

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isBusy}
            aria-label={buttonLabel}
            aria-pressed={isRecording}
            className={`grid size-20 place-items-center rounded-full border-4 border-white text-white shadow-lg ring-2 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-65 ${
              isRecording
                ? 'bg-[#b42318] ring-[#b42318]'
                : 'bg-accent ring-accent'
            }`}
          >
            {isRecording ? (
              <span className="size-7 rounded-md bg-white" aria-hidden="true" />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-10 fill-current"
              >
                <path d="M12 15.5a4 4 0 0 0 4-4v-5a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Zm-2-9a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Zm8.5 4.5a1 1 0 0 0-1 1 5.5 5.5 0 0 1-11 0 1 1 0 1 0-2 0 7.5 7.5 0 0 0 6.5 7.43V22H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.57A7.5 7.5 0 0 0 19.5 12a1 1 0 0 0-1-1Z" />
              </svg>
            )}
          </button>
          <span className="text-sm font-bold text-muted" aria-live="polite">
            {isRecording
              ? formatElapsedTime(elapsedMs)
              : status === 'requesting'
                ? 'Allow microphone'
                : status === 'saving'
                  ? 'Saving…'
                  : 'Record'}
          </span>
        </div>

        <NavLink to="/recordings" className={navigationClassName}>
          <span aria-hidden="true" className="text-2xl">
            ◉
          </span>
          Recordings ({recordingCount})
        </NavLink>
      </div>
    </footer>
  )
}
