import { useAppLocation, useAppNavigate } from '../routing/navigation'
import type { ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  decreaseTextSize,
  increaseTextSize,
  MAX_TEXT_SIZE_STEP,
  MIN_TEXT_SIZE_STEP,
  selectTextSizePercent,
  selectTextSizeStep,
} from '../store/textSizeSlice'

export function Header({ children }: { children?: ReactNode }) {
  const dispatch = useAppDispatch()
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
    <header className="border-b-2 border-ink/10 bg-white">
      <div className="mx-auto grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] sm:px-8">
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
          <div className="col-span-2 row-start-2 empty:hidden sm:col-span-1 sm:col-start-2 sm:row-start-1">
            {children}
          </div>
        )}
        <div
          className="flex shrink-0 items-center justify-self-end gap-2 sm:col-start-3"
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
    </header>
  )
}
