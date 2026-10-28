import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import cypress from 'cypress'
import { createServer, type ViteDevServer } from 'vite'
import { waitForBackend } from './e2e-readiness.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
const interactive = process.argv.includes('--open')
const coverage = process.argv.includes('--coverage')
if (mode !== 'mock' && mode !== 'live')
  throw new Error('Choose mock or live mode')

// Always use a separate API origin, including mock mode: an unexpected request
// cannot accidentally fall through to the developer's server on port 8000.
const apiUrl = 'http://127.0.0.1:8011'
const backendDirectory = resolve(
  process.env.E2E_BACKEND_DIR ?? resolve(root, '../voice-archive-api'),
)
const python =
  process.env.E2E_PYTHON ??
  resolve(
    backendDirectory,
    process.platform === 'win32'
      ? '.venv/Scripts/python.exe'
      : '.venv/bin/python',
  )
const database = `va_e2e_${randomUUID().replaceAll('-', '')}`
let temporaryDirectory: string | undefined
let backend: ChildProcess | undefined
let browser: ChildProcess | undefined
let backendFailed = false
let vite: ViteDevServer | undefined
let databaseCreated = false
let cleaning: Promise<void> | undefined

function launch(command: string, args: string[], cwd = root) {
  return spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true })
}

function isRunning(child: ChildProcess) {
  return (
    child.pid !== undefined &&
    child.exitCode === null &&
    child.signalCode === null
  )
}

async function completed(child: ChildProcess) {
  const [code] = await once(child, 'exit')
  if (code !== 0) throw new Error(`E2E subprocess exited with ${code}`)
}

function backendCommand(action: string) {
  return launch(
    python,
    [
      resolve(root, 'scripts/e2e-backend.py'),
      action,
      backendDirectory,
      database,
      temporaryDirectory!,
      '8011',
    ],
    backendDirectory,
  )
}

function cleanup() {
  cleaning ??= (async () => {
    if (browser && isRunning(browser)) {
      browser.stdin?.end()
      const exited = once(browser, 'exit')
      browser.kill()
      await exited
    }
    await vite?.close()
    if (backend && !backendFailed && isRunning(backend)) {
      const exited = once(backend, 'exit')
      backend.kill()
      await exited
    }
    if (databaseCreated) await completed(backendCommand('drop'))
    if (temporaryDirectory)
      await rm(temporaryDirectory, { recursive: true, force: true })
  })()
  return cleaning
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(130))
  })
}

try {
  temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'voice-archive-e2e-'))
  process.env.VITE_DATABASE_NAME = 'voice-archive-e2e-test'
  process.env.VITE_READER_PREFERENCES_KEY = 'voice-archive-reader-e2e-test'
  process.env.VITE_API_BASE_URL = apiUrl
  process.env.VITE_COVERAGE = coverage ? 'true' : 'false'
  process.env.VITE_E2E_TESTING_HARNESS = 'true'
  if (coverage) {
    await rm(resolve(root, '.nyc_output'), { recursive: true, force: true })
    await rm(resolve(root, 'coverage/cypress'), {
      recursive: true,
      force: true,
    })
    await mkdir(resolve(root, 'coverage/cypress'), { recursive: true })
  }
  if (mode === 'live') {
    try {
      await access(python)
    } catch {
      throw new Error(
        `Backend Python unavailable at ${python}. Run uv sync --locked in ${backendDirectory}, or set E2E_PYTHON to its interpreter.`,
      )
    }
    // Refuse to attach to an unknown process, even when it answers /ready.
    const { createServer: createTcpServer } = await import('node:net')
    const probe = createTcpServer()
    await new Promise<void>((accept, reject) => {
      probe.once('error', () =>
        reject(
          new Error(
            'E2E API port 8011 is occupied. Stop that test server before running live E2E.',
          ),
        ),
      )
      probe.listen(8011, '127.0.0.1', () => probe.close(() => accept()))
    })

    // Start the test database
    if (!process.env.E2E_SKIP_DB_START) {
      await completed(
        launch(
          'docker',
          ['compose', '--profile', 'test', 'up', '-d', '--wait', 'db-test'],
          backendDirectory,
        ),
      )
    }

    await completed(backendCommand('create'))
    databaseCreated = true
    await completed(backendCommand('migrate'))

    // Stays running while tests execute
    backend = backendCommand('serve')

    // Register an error handler before readiness polling.
    backend.on('error', (error) => {
      backendFailed = true
      console.error('Unable to launch test API:', error.message)
    })

    // Poll for backend readiness
    await waitForBackend(apiUrl, () => backendFailed || !isRunning(backend!))
  }

  // Start the frontend repo
  vite = await createServer({
    root,
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
  })
  await vite.listen()
  const options = {
    project: root,
    browser: 'chrome',
    expose: {
      mode,
      apiUrl,
      coverage,
      tags: mode === 'live' ? '@live' : undefined,
    },
  }
  if (interactive) {
    await cypress.open(options)
  } else {
    const resultPath = resolve(temporaryDirectory, 'browser-result.json')
    // An open stdin pipe avoids immediate EOF in Windows headless environments.
    browser = spawn(
      process.execPath,
      [
        resolve(root, 'scripts/cypress-browser.ts'),
        JSON.stringify(options),
        resultPath,
      ],
      {
        cwd: root,
        stdio: ['pipe', 'inherit', 'inherit'],
        windowsHide: true,
      },
    )
    await completed(browser)
    const result = JSON.parse(await readFile(resultPath, 'utf8')) as {
      passed: boolean
    }
    if (!result.passed)
      throw new Error('Cypress did not complete a passing, non-empty test run')
  }
} catch (error) {
  console.error(
    `${mode} E2E failed:`,
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
} finally {
  await cleanup()
}
