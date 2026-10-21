import { NavLink, useLocation } from 'react-router'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  decreaseTextSize,
  increaseTextSize,
  selectTextSizePercent,
  selectTextSizeStep,
  textSizeSteps,
} from '../store/textSizeSlice'

export function Header() {
  const dispatch = useAppDispatch()
  const textSizeStep = useAppSelector(selectTextSizeStep)
  const textSizePercent = useAppSelector(selectTextSizePercent)
  const location = useLocation()
  const pageTitle =
    location.pathname === '/recordings' ? 'Your voice' : 'Your library'

  return (
    <header className="border-b-2 border-ink/10 bg-white">
      <div className="mx-auto flex flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <NavLink to="/" end>
            <p className="text-lg font-semibold text-accent">Voice Archive</p>
          </NavLink>
          <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
            {pageTitle}
          </h1>
        </div>

        <div
          className="flex w-fit items-center gap-2 rounded-2xl border-2 border-ink/15 bg-page p-2"
          aria-label="Text size controls"
        >
          <span className="px-2 text-lg font-semibold">Text size</span>
          <button
            type="button"
            className="grid min-h-12 min-w-12 place-items-center rounded-xl bg-white text-2xl font-bold shadow-sm ring-1 ring-ink/15 hover:bg-accent-soft focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => dispatch(decreaseTextSize())}
            disabled={textSizeStep === 0}
            aria-label="Make text smaller"
          >
            A−
          </button>
          <button
            type="button"
            className="grid min-h-12 min-w-12 place-items-center rounded-xl bg-white text-2xl font-bold shadow-sm ring-1 ring-ink/15 hover:bg-accent-soft focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => dispatch(increaseTextSize())}
            disabled={textSizeStep === textSizeSteps.length - 1}
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
