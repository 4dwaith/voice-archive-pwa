import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('API base URL', () => {
  it('keeps the loopback default outside a browser', async () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined)

    const { apiBaseUrl } = await import('../../src/api-client/baseApi')

    expect(new URL('/api/v1/books', apiBaseUrl).href).toBe(
      'http://127.0.0.1:8000/api/v1/books',
    )
  })

  it.each(['https://192.0.2.22', 'http://localhost:5173'])(
    'resolves a relative base against %s',
    async (origin) => {
      vi.stubEnv('VITE_API_BASE_URL', '/')
      vi.stubGlobal('location', { origin })

      const { apiBaseUrl } = await import('../../src/api-client/baseApi')

      expect(apiBaseUrl).toBe(`${origin}/`)
      expect(new URL('/api/v1/files/9', apiBaseUrl).href).toBe(
        `${origin}/api/v1/files/9`,
      )
    },
  )

  it('preserves an explicitly configured API origin', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8123')
    vi.stubGlobal('location', { origin: 'http://localhost:5173' })

    const { apiBaseUrl } = await import('../../src/api-client/baseApi')

    expect(apiBaseUrl).toBe('http://127.0.0.1:8123/')
  })
})
