import { describe, expect, it, vi } from 'vitest'
import { waitForBackend } from '../../scripts/e2e-readiness'

describe('live E2E backend readiness', () => {
  it('waits for database readiness after connection refusal and a 503', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Connection refused'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    await waitForBackend('http://127.0.0.1:8011', () => false, 1000, 1)

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8011/api/v1/ready')
  })

  it('fails clearly when the backend stays unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Connection refused')),
    )

    await expect(
      waitForBackend('http://127.0.0.1:8011', () => false, 20, 1),
    ).rejects.toThrow(
      'Test backend unavailable at http://127.0.0.1:8011. Check Docker, the backend Python environment, and .env.test.',
    )
  })

  it('fails immediately if the launched server exits', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(
      waitForBackend('http://127.0.0.1:8011', () => true),
    ).rejects.toThrow('Test backend unavailable')
    expect(fetch).not.toHaveBeenCalled()
  })
})
