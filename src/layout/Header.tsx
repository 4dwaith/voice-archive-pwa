import { useAppLocation, useAppNavigate } from '../routing/navigation'
import { useState, type ReactNode } from 'react'
import { getCurrentUser } from '../store/authSlice'
import { signOut } from '../services/auth'
import { SettingsDialog } from './SettingsDialog'
import {
  getPreferredLanguage,
  setPreferredLanguage,
  type PreferredLanguage,
} from '../store/userPreferencesSlice'
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
  const user = useAppSelector(getCurrentUser)
  const preferredLanguage = useAppSelector(getPreferredLanguage)
  const [signOutFailed, setSignOutFailed] = useState(false)

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

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
          {location.pathname.startsWith('/books/') && children}
          {actions}
          <SettingsDialog
            title="Controls"
            description="Adjust text size and narration speed. Changes are saved automatically."
            trigger={
              <button
                type="button"
                className="min-h-12 rounded-xl border-2 border-ink px-4 font-bold focus-visible:outline-4 focus-visible:outline-accent"
              >
                Controls
              </button>
            }
          >
            <p className="font-bold">Playback speed</p>
            <div
              className="flex flex-wrap items-center gap-2"
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
              className="flex flex-wrap items-center gap-2"
              aria-label="Text size controls"
            >
              <span className="font-bold">Text size</span>
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
              <span aria-live="polite">{textSizePercent}%</span>
            </div>
          </SettingsDialog>
        </div>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <SettingsDialog
            title="User preferences"
            description="Choose the language Live uses when starting or continuing a conversation. Saved on this browser."
            trigger={
              <button
                type="button"
                aria-label="User preferences"
                className="min-h-12 rounded-xl border-2 border-ink px-3 font-bold focus-visible:outline-4 focus-visible:outline-accent"
              >
                {user?.display_name || user?.email || 'Guest'}
              </button>
            }
          >
            <label className="flex flex-col gap-2 font-bold">
              Preferred language
              <select
                value={preferredLanguage}
                onChange={(event) =>
                  dispatch(
                    setPreferredLanguage(
                      event.target.value as PreferredLanguage,
                    ),
                  )
                }
                className="min-h-12 w-full min-w-0 border-2 border-ink bg-white px-3 focus-visible:outline-4 focus-visible:outline-accent"
              >
                <option value="kannada">ಕನ್ನಡ (Kannada)</option>
                <option value="english">English</option>
              </select>
            </label>
          </SettingsDialog>
          <button
            className="min-h-12 border-2 border-ink px-3 font-bold"
            onClick={() => {
              if (!user) {
                void navigate('/login')
                return
              }
              void signOut().catch((error) => {
                console.warn('Sign-out failed.', error)
                setSignOutFailed(true)
              })
            }}
          >
            {user ? 'Sign out' : 'Sign in'}
          </button>
          {signOutFailed && (
            <p role="alert">Sign-out failed. Please try again.</p>
          )}
        </div>
      </div>
    </header>
  )
}
