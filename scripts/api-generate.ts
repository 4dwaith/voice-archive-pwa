import { openApiUrl } from './api-config.ts'
import { refreshContract } from './api-generation.ts'

const mode = process.argv[2]
const isCheckMode = mode === '--check'
const isWriteMode = mode === '--write'
if (!isCheckMode && !isWriteMode) {
  throw new Error(
    'Choose --check (report only) or --write (replace generated files)',
  )
}
try {
  const differences = await refreshContract({
    check: isCheckMode,
    url: openApiUrl,
  })
  const hasStaleFiles = differences.length > 0
  if (isCheckMode && hasStaleFiles) {
    const staleFileNames = differences.join(', ')
    console.error(
      `Stale API files: ${staleFileNames}. Run npm run api:regenerate.`,
    )
    // Report failure to CI/IDE runners without terminating cleanup in helpers.
    process.exitCode = 1
  } else {
    const successMessage = isCheckMode
      ? 'API contract is up to date.'
      : 'API files regenerated. Review the diff before committing.'
    console.log(successMessage)
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  console.error(`API generation failed: ${errorMessage}`)
  process.exitCode = 1
}
