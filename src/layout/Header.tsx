import { useAppLocation, useAppNavigate } from '../routing/navigation'
import type { ReactNode } from 'react'
import {
  adjustPlaybackSpeed,
  MAX_PLAYBACK_SPEED_STEP,
  selectPlaybackSpeed,
  selectPlaybackSpeedStep,
} from '../store/playbackSpeedSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  decreaseTextSize,
  increaseTextSize,
  MAX_TEXT_SIZE_STEP,
  MIN_TEXT_SIZE_STEP,
  selectTextSizePercent,
  selectTextSizeStep,
} from '../store/textSizeSlice'

export function Header({
  children,
  actions,
}: {
  children?: ReactNode
  actions?: ReactNode
}) {
  const dispatch = useAppDispatch()
  const speed = useAppSelector(selectPlaybackSpeed)
  const speedStep = useAppSelector(selectPlaybackSpeedStep)
  const textSizeStep = useAppSelector(selectTextSizeStep)
  const textSizePercent = useAppSelector(selectTextSizePercent)
  const location = useAppLocation()
  const navigate = useAppNavigate()

  function goHome() {
    // BrowserRouter's index counts entries within the app, unlike history.length.
    if (window.history.state?.idx > 0) void navigate(-1)
    else void navigate('/', { replace: true })
  }

  return (
    <header className="max-h-[50dvh] overflow-y-auto border-b-2 border-ink/10 bg-white">
      <div className="mx-auto flex flex-wrap items-center justify-between gap-2 py-2 pl-30 pr-3 sm:pr-8">
        {location.pathname === '/' ? (
          <h1 className="text-xl font-bold">Your library</h1>
        ) : (
          <button
            type="button"
            onClick={goHome}
            className="min-h-12 justify-self-start rounded-xl border-2 border-ink px-4 font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Home
          </button>
        )}

        {location.pathname.startsWith('/books/') && (
          <div className="flex flex-1 justify-center empty:hidden">
            {children}
          </div>
        )}
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          {actions}
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Speaking speed controls"
          >
            <button
              type="button"
              className="min-h-12 min-w-12 rounded-xl border-2 border-ink bg-white px-2 text-xl font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
              onClick={() => dispatch(adjustPlaybackSpeed(-1))}
              disabled={speedStep === 0}
              aria-label="Speak slower"
            >
              −
            </button>
            <span
              className="min-w-14 text-center font-bold"
              aria-label="Speaking speed"
              aria-live="polite"
            >
              {speed.toFixed(2)}×
            </span>
            <button
              type="button"
              className="min-h-12 min-w-12 rounded-xl border-2 border-ink bg-white px-2 text-xl font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
              onClick={() => dispatch(adjustPlaybackSpeed(1))}
              disabled={speedStep === MAX_PLAYBACK_SPEED_STEP}
              aria-label="Speak faster"
            >
              +
            </button>
          </div>
          <div
            className="flex items-center gap-2"
            aria-label="Text size controls"
          >
            <button
              type="button"
              className="grid min-h-12 min-w-12 place-items-center rounded-xl bg-white text-2xl font-bold shadow-sm ring-1 ring-ink/15 hover:bg-accent-soft focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => dispatch(decreaseTextSize())}
              disabled={textSizeStep === MIN_TEXT_SIZE_STEP}
              aria-label="Make text smaller"
            >
              A−
            </button>
            <button
              type="button"
              className="grid min-h-12 min-w-12 place-items-center rounded-xl bg-white text-2xl font-bold shadow-sm ring-1 ring-ink/15 hover:bg-accent-soft focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => dispatch(increaseTextSize())}
              disabled={textSizeStep === MAX_TEXT_SIZE_STEP}
              aria-label="Make text larger"
            >
              A+
            </button>
            <span className="sr-only" aria-live="polite">
              Text size {textSizePercent} percent
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
