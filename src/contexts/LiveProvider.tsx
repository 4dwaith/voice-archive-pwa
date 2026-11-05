import { LiveContext } from './LiveContext'
import { useEffect, type ReactNode } from 'react'
import { useAppStore } from '../store/hooks'
import {
  getLiveSession,
  initializeLiveSession,
  requestLiveSession,
} from '../store/liveSlice'
import { livePageTurnerBinding } from '../services/pageTurnerBindings'

export function LiveProvider({ children }: { children: ReactNode }) {
  const store = useAppStore()

  useEffect(() => {
    store.dispatch(initializeLiveSession())
    return () => {
      store.dispatch(requestLiveSession({ kind: 'stop' }))
    }
  }, [store])

  useEffect(() => {
    function handleLiveKey(event: KeyboardEvent) {
      const selection = document.getSelection()
      if (
        event.key !== livePageTurnerBinding.key ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.isComposing ||
        event
          .composedPath()
          .some(
            (target) =>
              target instanceof Element &&
              target.matches(
                'button, a, input, select, textarea, summary, [role="button"], [role="slider"], [contenteditable]:not([contenteditable="false"])',
              ),
          ) ||
        (selection && !selection.isCollapsed)
      )
        return

      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return

      const status = getLiveSession(store.getState()).status
      store.dispatch(
        requestLiveSession({
          kind:
            status === 'connecting' || status === 'connected'
              ? 'stop'
              : 'start',
        }),
      )
    }

    window.addEventListener('keydown', handleLiveKey, true)
    return () => window.removeEventListener('keydown', handleLiveKey, true)
  }, [store])

  return <LiveContext.Provider value={true}>{children}</LiveContext.Provider>
}
