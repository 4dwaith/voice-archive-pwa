import { useSyncExternalStore } from 'react'
import { useLiveConversation } from '../../../contexts/LiveContext'

export function LiveButton() {
  const conversation = useLiveConversation()
  return conversation ? (
    <ConnectedLiveButton conversation={conversation} />
  ) : null
}

function ConnectedLiveButton({
  conversation,
}: {
  conversation: NonNullable<ReturnType<typeof useLiveConversation>>
}) {
  const { status, error } = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  )
  const isActive = status === 'connecting' || status === 'connected'
  const label = isActive ? 'Stop Live' : 'Start Live'
  return (
    <div
      className="relative shrink-0"
      data-live-control
      data-live-state={status}
      data-reader-overlay
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={isActive}
        title={status === 'connecting' ? 'Connecting — Stop Live' : label}
        className={`inline-flex min-h-12 min-w-12 items-center justify-center border-2 border-ink p-2 focus-visible:outline-4 focus-visible:outline-accent ${isActive ? 'bg-ink text-page' : 'bg-page text-ink'}`}
        onClick={() =>
          isActive ? conversation.stop() : void conversation.start()
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
      <span aria-live="polite" className="sr-only">
        Live {status}
      </span>
      {error && (
        <p
          role="alert"
          className="absolute left-0 top-full z-50 w-64 border-2 border-ink bg-page p-2 text-base text-ink"
        >
          {error}
        </p>
      )}
    </div>
  )
}
