import { useAppNavigate, useAppLocation } from '../routing/navigation'
import { LiveContext } from './LiveContext'
import { useEffect, useRef, type ReactNode } from 'react'
import { useAppStore } from '../store/hooks'
import {
  getLiveSession,
  initializeLiveSession,
  requestLiveSession,
} from '../store/liveSlice'
import { reportCommandRoute } from '../store/readerCommandsSlice'
import { livePageTurnerBinding } from '../services/pageTurnerBindings'

export function LiveProvider({ children }: { children: ReactNode }) {
  const store = useAppStore()
  const navigate = useAppNavigate()
  const navigateRef = useRef(navigate)

  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  const location = useAppLocation()

  useEffect(() => {
    store.dispatch(reportCommandRoute(location.pathname))
  }, [store, location.key, location.pathname])

  useEffect(
    () =>
      store.registerCommandNavigation((path) => {
        void navigateRef.current(path)
      }),
    [store],
  )

  useEffect(() => {
    store.dispatch(initializeLiveSession())
    return () => {
      store.dispatch(requestLiveSession({ kind: 'stop' }))
    }
  }, [store])

  useEffect(() => {
    function handleLiveKey(event: KeyboardEvent) {
      if (event.key !== livePageTurnerBinding.key) return

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
