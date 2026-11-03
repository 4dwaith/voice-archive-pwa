import { useReaderContext } from '../../../contexts/ReaderContext'
import { NavigationArrows } from '../../atoms/ReaderProgressNavigation/NavigationArrows'

export function ReaderAudioButton() {
  const audio = useReaderContext().reader.audio
  if (!audio) return null
  return (
    <button
      type="button"
      data-reader-audio-control
      aria-label={audio.isPlaying ? 'Pause' : 'Play'}
      disabled={!audio.canPlay && !audio.isPlaying}
      className="inline-flex min-h-12 min-w-12 items-center justify-center border-2 border-ink bg-page px-3 py-2 text-lg font-bold text-ink focus-visible:outline-4 focus-visible:outline-accent disabled:opacity-50"
      onClick={audio.togglePlayback}
    >
      {audio.isPlaying ? (
        <svg
          aria-hidden="true"
          className="h-[max(24px,1em)] w-[max(36px,1.5em)] shrink-0 text-lg"
          viewBox="0 0 36 24"
          fill="currentColor"
        >
          <rect x="10" y="3" width="6" height="18" />
          <rect x="20" y="3" width="6" height="18" />
        </svg>
      ) : (
        <NavigationArrows direction={1} noOfArrows={1} />
      )}
    </button>
  )
}
