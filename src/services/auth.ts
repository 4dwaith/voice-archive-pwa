import { apiBaseUrl } from '../api-client/baseApi'
import { UserResponse } from '../api-client/generated/schemas'
import { database } from '../data/database'
import {
  readReaderPreferences,
  writeReaderPreferences,
} from '../data/readerPreferences'

const accountKey = `${import.meta.env.VITE_DATABASE_NAME || 'voice-archive'}:account`

export async function clearAccountData(userId: number | null) {
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) await table.clear()
  })
  writeReaderPreferences({ ...readReaderPreferences(), positions: {} })
  sessionStorage.removeItem('voice-archive-live-checkpoint')
  localStorage.setItem(accountKey, String(userId))
}

export function hasMatchingAccount(userId: number | null) {
  return localStorage.getItem(accountKey) === String(userId)
}

export async function signIn(email: string, password: string) {
  const response = await fetch(new URL('/api/v1/auth/login', apiBaseUrl), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok)
    throw new Error(
      'Sign-in failed. Check your email and password and try again.',
    )
  const user = UserResponse.parse(await response.json())
  await clearAccountData(user.id)
  window.location.replace('/')
}

export async function signOut() {
  const response = await fetch(new URL('/api/v1/auth/logout', apiBaseUrl), {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Sign-out failed. Please try again.')
  await clearAccountData(null)
  window.location.replace('/')
}
