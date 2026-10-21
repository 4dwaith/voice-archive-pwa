import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CoverageMapData } from 'istanbul-lib-coverage'
import { mergeFrontendCoverage } from './coverage-merge.ts'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function readCoverage(path: string) {
  const report = JSON.parse(await readFile(path, 'utf8')) as CoverageMapData
  const files = Object.entries(report)
  for (const metric of ['s', 'f', 'b'] as const) {
    const counts = files.flatMap(([, file]) =>
      Object.values(file[metric]).flat(),
    )
    if (!counts.length || !counts.some((count) => count > 0)) {
      throw new Error(`${path} has no executed ${metric} coverage`)
    }
  }
  for (const [file] of files) {
    const normalized = file.replaceAll('\\', '/')
    if (
      !normalized.includes('/src/') ||
      /\/generated\/|\/mock-data\/|\.stories\./.test(normalized)
    ) {
      throw new Error(`Non-application file in coverage: ${file}`)
    }
  }
  return report
}

async function run(script: string, args: string[]) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  })
  const [code] = await once(child, 'exit')
  if (code !== 0) throw new Error(`Coverage command failed (${code})`)
}

try {
  if (!process.argv.includes('--merge-only')) {
    await rm(resolve(root, 'coverage'), { recursive: true, force: true })
    await run(
      resolve(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'),
      ['run', '--coverage'],
    )
    await run(resolve(root, 'scripts/cypress.ts'), ['mock', '--coverage'])
  }
  const [vitest, cypress] = await Promise.all(
    ['vitest', 'cypress'].map((suite) =>
      readCoverage(resolve(root, `coverage/${suite}/coverage-final.json`)),
    ),
  )
  const combined = mergeFrontendCoverage(vitest, cypress)
  const nyc = require.resolve('nyc/bin/nyc.js')
  await rm(resolve(root, 'coverage/merged'), { recursive: true, force: true })
  await mkdir(resolve(root, 'coverage/merged'), { recursive: true })
  await writeFile(
    resolve(root, 'coverage/merged/coverage.json'),
    JSON.stringify(combined),
  )
  await run(nyc, [
    'report',
    '--temp-dir=coverage/merged',
    '--report-dir=coverage/combined',
    '--reporter=html',
    '--reporter=lcov',
    '--reporter=text-summary',
    '--reporter=json',
  ])
  await readCoverage(resolve(root, 'coverage/combined/coverage-final.json'))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
