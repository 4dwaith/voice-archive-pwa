import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { apiBaseUrl } from '../api-client/baseApi.ts'
import { UserResponse } from '../api-client/generated/schemas.ts'
import { clearAccountData, hasMatchingAccount } from '../services/auth.ts'
import { useAppDispatch } from '../store/hooks.ts'
import { setCurrentUser } from '../store/authSlice.ts'

export function AuthGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function checkSession() {
      try {
        const response = await fetch(new URL('/api/v1/auth/me', apiBaseUrl), {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })
        const isExpired = response.status === 401
        if (!response.ok && !isExpired)
          throw new Error(`Session check failed (${response.status})`)
        let user = null
        if (!isExpired)
          user = UserResponse.nullable().parse(await response.json())
        if (controller.signal.aborted) return
        if (!hasMatchingAccount(user?.id ?? null)) {
          await clearAccountData(user?.id ?? null)
          if (!controller.signal.aborted) window.location.reload()
          return
        }
        if (!user) sessionStorage.removeItem('voice-archive-live-checkpoint')
        dispatch(setCurrentUser(user))
        setExpired(isExpired)
        setReady(true)
      } catch (error) {
        if (controller.signal.aborted) return
        console.warn('The session could not be checked.', error)
        setFailed(true)
      }
    }
    void checkSession()
    return () => controller.abort()
  }, [dispatch])

  if (ready) {
    if (expired && location.pathname !== '/login')
      return <Navigate to="/login?expired=1" replace />
    return children
  }
  return (
    <main className="bg-page p-8 text-xl text-ink">
      <p role={failed ? 'alert' : 'status'}>
        {failed
          ? 'Your session could not be checked. Reconnect and try again.'
          : 'Checking your session…'}
      </p>
      {failed && (
        <button
          className="mt-4 min-h-12 border-2 border-ink p-3"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      )}
    </main>
  )
}
