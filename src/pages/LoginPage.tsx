import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { signIn, signOut } from '../services/auth'
import { useAppSelector } from '../store/hooks'
import { isLoginEnabled } from '../store/authSlice'

export function LoginPage() {
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const loginEnabled = useAppSelector(isLoginEnabled)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!loginEnabled) return
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await signIn(String(fields.get('email')), String(fields.get('password')))
    } catch (cause) {
      console.warn('Sign-in failed.', cause)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Sign-in failed. Please try again.',
      )
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex max-w-lg flex-col gap-5 p-6">
      <h1 className="text-3xl font-bold">Sign in</h1>
      {!loginEnabled && (
        <aside
          aria-label="Demo restrictions"
          className="flex flex-col gap-4 border-2 border-ink bg-white p-4"
        >
          <h2 className="text-2xl font-bold">
            Sign-in is restricted during this demo
          </h2>
          <p>You can continue reading public books as a guest.</p>
          <p>
            To use sign-in and the full features, set up Voice Archive locally
            using the instructions in the GitHub repositories.
          </p>
          <a
            href="https://github.com/4dwaith/voice-archive-pwa#development"
            className="inline-flex min-h-12 items-center font-bold underline focus-visible:outline-4 focus-visible:outline-accent"
          >
            Frontend setup on GitHub
          </a>
          <a
            href="https://github.com/4dwaith/voice-archive-api#readme"
            className="inline-flex min-h-12 items-center font-bold underline focus-visible:outline-4 focus-visible:outline-accent"
          >
            Backend setup on GitHub
          </a>
        </aside>
      )}
      {loginEnabled && params.has('expired') && (
        <p role="status">Your session expired. Please sign in again.</p>
      )}
      {error && <p role="alert">{error}</p>}
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => void submit(event)}
      >
        <label className="flex flex-col gap-2">
          Email
          <input
            className="min-h-12 border-2 border-ink p-3"
            type="email"
            name="email"
            autoComplete="username"
            required
            disabled={busy || !loginEnabled}
          />
        </label>
        <label className="flex flex-col gap-2">
          Password
          <input
            className="min-h-12 border-2 border-ink p-3"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={busy || !loginEnabled}
          />
        </label>
        <button
          type="submit"
          className="min-h-12 border-2 border-ink bg-ink p-3 font-bold text-page disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !loginEnabled}
        >
          Sign in
        </button>
      </form>
      <button
        className="min-h-12 border-2 border-ink p-3"
        disabled={busy}
        onClick={() =>
          void signOut().catch((cause) => {
            console.warn('Guest entry failed.', cause)
            setError('Could not continue as a guest. Please try again.')
          })
        }
      >
        Continue without signing in
      </button>
    </section>
  )
}
