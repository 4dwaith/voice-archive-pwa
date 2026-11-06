import { useContext, type MouseEvent } from 'react'
import { LiveContext } from '../../../contexts/LiveContext'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import { getReaderCommandError } from '../../../store/readerCommandsSlice'
import { getLiveSession, requestLiveSession } from '../../../store/liveSlice'

export function LiveButton() {
  return useContext(LiveContext) ? <ConnectedLiveButton /> : null
}

function ConnectedLiveButton() {
  const dispatch = useAppDispatch()
  const { status, error, canContinue } = useAppSelector(getLiveSession)
  const commandError = useAppSelector(getReaderCommandError)
  const isActive = status === 'connecting' || status === 'connected'
  const label = isActive
    ? 'Stop Live'
    : canContinue
      ? 'Continue Live'
      : 'Start Live'
  function discardConversationAndRestoreFocus(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    const button = event.currentTarget
    const focusTarget =
      button.closest<HTMLElement>('[role="dialog"]') ??
      button.ownerDocument.querySelector<HTMLElement>(
        '[data-reader-surface]',
      ) ??
      button.ownerDocument.querySelector<HTMLElement>('main')

    button.blur()
    dispatch(requestLiveSession({ kind: 'discard' }))
    // Restore focus after the click finishes and React removes the button.
    requestAnimationFrame(() => {
      if (!focusTarget?.isConnected) return
      focusTarget.setAttribute('data-reader-restoring-focus', '')
      try {
        focusTarget.focus({ preventScroll: true })
      } finally {
        focusTarget.removeAttribute('data-reader-restoring-focus')
      }
    })
  }

  return (
    <div
      className="relative flex shrink-0 items-center gap-2"
      data-live-control
      data-live-state={status}
      data-reader-overlay
    >
      {commandError && (
        <p role="alert" className="max-w-80 border-2 border-ink bg-page p-2">
          {commandError.message}
        </p>
      )}
      <button
        type="button"
        aria-label={label}
        aria-pressed={isActive}
        title={status === 'connecting' ? 'Connecting — Stop Live' : label}
        className={`inline-flex min-h-12 min-w-12 items-center justify-center border-2 border-ink p-2 focus-visible:outline-4 focus-visible:outline-accent ${isActive ? 'bg-ink text-page' : 'bg-page text-ink'}`}
        onClick={() =>
          dispatch(requestLiveSession({ kind: isActive ? 'stop' : 'start' }))
        }
      >
        <svg
          aria-hidden="true"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {status === 'connecting' ? (
            <path d="M6 2h12M6 22h12M7 2v5l10 10v5M17 2v5L7 17v5" />
          ) : isActive ? (
            <rect x="5" y="5" width="14" height="14" fill="currentColor" />
          ) : (
            <>
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
            </>
          )}
        </svg>
      </button>
      {!isActive && canContinue && (
        <button
          type="button"
          aria-label="Discard Live conversation"
          title="Discard Live conversation"
          className="inline-flex min-h-12 min-w-12 items-center justify-center border-2 border-ink bg-page p-2 text-ink focus-visible:outline-4 focus-visible:outline-accent"
          onClick={discardConversationAndRestoreFocus}
        >
          <svg
            aria-hidden="true"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
          </svg>
        </button>
      )}
      <div className="absolute left-0 top-full z-50 w-64 bg-page text-ink">
        <span aria-live="polite" className="sr-only">
          Live {status}
        </span>
        {error && (
          <p role="alert" className="border-2 border-ink p-2 text-base">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
