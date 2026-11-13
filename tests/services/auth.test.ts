// @vitest-environment jsdom
import '../helpers/database'
import { describe, expect, it, vi } from 'vitest'
import { database } from '../../src/data/database'
import {
  clearAccountData,
  hasMatchingAccount,
  signIn,
} from '../../src/services/auth'
import {
  readReaderPreferences,
  writeReaderPreferences,
} from '../../src/data/readerPreferences'
import { book } from '../api-client/fixtures/book'

describe('Account cleanup', () => {
  it('clears cached data and positions while preserving device preferences', async () => {
    await database.books.put(book)
    await database.recordings.put({
      id: 'old',
      createdAt: '2026-01-01',
      durationMs: 1,
      mimeType: 'audio/wav',
      size: 1,
      blob: new Blob(['x']),
    })
    writeReaderPreferences({
      ...readReaderPreferences(),
      textSizeStep: 2,
      positions: { '1': { version: 'old', sourceKey: 'private', offset: 0 } },
    })
    sessionStorage.setItem('voice-archive-live-checkpoint', 'old')

    await clearAccountData(null)

    expect(await database.books.count()).toBe(0)
    expect(await database.recordings.count()).toBe(0)
    expect(readReaderPreferences().positions).toEqual({})
    expect(readReaderPreferences().textSizeStep).toBe(2)
    expect(sessionStorage.getItem('voice-archive-live-checkpoint')).toBeNull()
    expect(hasMatchingAccount(null)).toBe(true)
    expect(hasMatchingAccount(2)).toBe(false)
  })

  it('keeps cached data when sign-in is rejected', async () => {
    await database.books.put(book)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    )

    await expect(signIn('reader@example.com', 'incorrect')).rejects.toThrow(
      'Sign-in failed',
    )

    expect(await database.books.get(book.id)).toEqual(book)
  })
})
