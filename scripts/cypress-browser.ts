import { writeFile } from 'node:fs/promises'
import cypress from 'cypress'

// Keep browser execution separate from the server-owning process. On Windows,
// Cypress pipes its streams and may close stdout when its Electron child exits.
// A result file lets the parent distinguish a completed run from an early exit.
try {
  const result = await cypress.run(JSON.parse(process.argv[2]))
  const passed =
    'totalFailed' in result && result.totalFailed === 0 && result.totalTests > 0
  await writeFile(process.argv[3], JSON.stringify({ passed }))
  process.exitCode = passed ? 0 : 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  process.stdin.destroy()
}
