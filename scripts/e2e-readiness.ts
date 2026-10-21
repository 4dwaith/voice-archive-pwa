import { setTimeout } from 'node:timers/promises'

export async function waitForBackend(
  apiUrl: string,
  isStopped: () => boolean,
  timeoutMs = 30_000,
  pollMs = 250,
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && !isStopped()) {
    try {
      const response = await fetch(`${apiUrl}/api/v1/ready`, {
        signal: AbortSignal.timeout(Math.min(timeoutMs, 1000)),
      })
      if (response.ok) return
    } catch {
      // Connection refusal is expected while Uvicorn starts.
    }
    await setTimeout(pollMs)
  }
  throw new Error(
    `Test backend unavailable at ${apiUrl}. Check Docker, the backend Python environment, and .env.test.`,
  )
}
