import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generate as generateSchemas } from 'orval'
import {
  normalizeForGenerators,
  refreshContract,
} from '../../scripts/api-generation.ts'
import { generatorFixture } from './fixtures/minimal-openapi'
import { integrationContract } from './fixtures/integration-openapi'
import { loadGeneratedRegistry } from './helpers/load-generated-registry'

// All normal tests use real Orval. One test injects a failure at this boundary.
vi.mock('orval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('orval')>()
  return { ...actual, generate: vi.fn(actual.generate) }
})

const temporaryDirectories: string[] = []

async function createTargetDirectory(): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), 'voice-archive-test-'))
  temporaryDirectories.push(target)
  return target
}

async function readDirectoryContents(
  directory: string,
): Promise<Record<string, string>> {
  const names = await readdir(directory)
  const entries = await Promise.all(
    names.map(async (name) => [
      name,
      await readFile(join(directory, name), 'utf8'),
    ]),
  )
  return Object.fromEntries(entries)
}

function useContract(document: unknown = generatorFixture): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(document)),
  )
}

const openApiUrl = 'http://backend.test/openapi.json'
afterEach(async () => {
  for (const path of temporaryDirectories.splice(0)) {
    if (
      dirname(resolve(path)) !== resolve(tmpdir()) ||
      !basename(path).startsWith('voice-archive-test-')
    ) {
      throw new Error('Refusing unsafe test cleanup')
    }
    await rm(path, { recursive: true, force: true })
  }
})

describe('generation workflow', () => {
  it('adds only the binary compatibility hint and preserves the original document', () => {
    const original = {
      type: 'string',
      contentMediaType: 'application/octet-stream',
    }
    expect(normalizeForGenerators(original)).toEqual({
      ...original,
      format: 'binary',
    })
    expect(original).not.toHaveProperty('format')
  })

  it('regenerates deterministically and reports stale files without modifying them', async () => {
    const target = await mkdtemp(join(tmpdir(), 'voice-archive-test-'))
    temporaryDirectories.push(target)
    const fetchMock = vi.fn(async () => Response.json(generatorFixture))
    vi.stubGlobal('fetch', fetchMock)
    const options = { url: 'http://backend.test/openapi.json', target }
    await refreshContract({ ...options, check: false })
    const names = await readdir(target)
    const before = await Promise.all(
      names.map((name) => readFile(join(target, name), 'utf8')),
    )
    expect(await refreshContract({ ...options, check: true })).toEqual([])
    expect(
      await Promise.all(
        names.map((name) => readFile(join(target, name), 'utf8')),
      ),
    ).toEqual(before)
    const stale = '// intentionally stale generated file\n'
    await writeFile(join(target, 'endpoints.ts'), stale)
    expect(await refreshContract({ ...options, check: true })).toEqual([
      'endpoints.ts',
    ])
    expect(await readFile(join(target, 'endpoints.ts'), 'utf8')).toBe(stale)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(names.sort()).toEqual([
      'endpoints.ts',
      'schemas.ts',
      'validation.ts',
    ])
  }, 30_000)

  it('leaves generated files untouched when the backend cannot supply OpenAPI', async () => {
    const target = await mkdtemp(join(tmpdir(), 'voice-archive-test-'))
    temporaryDirectories.push(target)
    await writeFile(join(target, 'endpoints.ts'), 'preserve me')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unavailable', { status: 503 })),
    )
    await expect(
      refreshContract({
        check: false,
        url: 'http://backend.test/openapi.json',
        target,
      }),
    ).rejects.toThrow('HTTP 503')
    expect(await readFile(join(target, 'endpoints.ts'), 'utf8')).toBe(
      'preserve me',
    )
  })

  it('reports missing and extra files without writing, then repairs stale output and removes obsolete generated files', async () => {
    const target = await createTargetDirectory()
    useContract()
    const options = { url: openApiUrl, target }
    await refreshContract({ ...options, check: false })
    const original = await readDirectoryContents(target)
    const generatedHeader = original['endpoints.ts'].split('\n')[0]
    await writeFile(join(target, 'endpoints.ts'), '// stale\n')
    await rm(join(target, 'schemas.ts'))
    await writeFile(
      join(target, 'obsolete.ts'),
      generatedHeader + '\n// obsolete\n',
    )
    const stale = await readDirectoryContents(target)
    const expectedDifferences = ['endpoints.ts', 'obsolete.ts', 'schemas.ts']
    expect(await refreshContract({ ...options, check: true })).toEqual(
      expectedDifferences,
    )
    expect(await readDirectoryContents(target)).toEqual(stale)
    expect(await refreshContract({ ...options, check: false })).toEqual(
      expectedDifferences,
    )
    expect(await readDirectoryContents(target)).toEqual(original)
  }, 30_000)

  it('reports a missing output directory without creating it', async () => {
    const root = await createTargetDirectory()
    const target = join(root, 'not-created')
    useContract()
    expect(
      await refreshContract({ check: true, url: openApiUrl, target }),
    ).toEqual(['endpoints.ts', 'schemas.ts', 'validation.ts'])
    await expect(readdir(target)).rejects.toMatchObject({ code: 'ENOENT' })
  }, 30_000)

  it('preserves every existing file when an unfamiliar obsolete file prevents replacement', async () => {
    const target = await createTargetDirectory()
    useContract()
    await refreshContract({ check: false, url: openApiUrl, target })
    const original = await readDirectoryContents(target)
    const generatedHeader = original['endpoints.ts'].split('\n')[0]
    // Sort the marked obsolete file first, to catch deletion before validation.
    await writeFile(
      join(target, 'a-obsolete.ts'),
      generatedHeader + '\n// obsolete\n',
    )
    await writeFile(join(target, 'notes.txt'), 'handwritten notes')
    await writeFile(
      join(target, 'endpoints.ts'),
      '// preserve stale output too\n',
    )
    const before = await readDirectoryContents(target)
    await expect(
      refreshContract({ check: false, url: openApiUrl, target }),
    ).rejects.toThrow('Unrecognized file in generated directory: notes.txt')
    expect(await readDirectoryContents(target)).toEqual(before)
  }, 30_000)

  it('preserves output and cleans temporary generation files if Orval fails after RTK generation', async () => {
    const target = await createTargetDirectory()
    useContract()
    await refreshContract({ check: false, url: openApiUrl, target })
    const before = await readDirectoryContents(target)
    let workspace: string | undefined
    vi.mocked(generateSchemas).mockImplementationOnce(async (options) => {
      if (
        !options ||
        typeof options !== 'object' ||
        !('input' in options) ||
        typeof options.input !== 'string'
      ) {
        throw new Error('Expected the generator input filename')
      }
      const staging = join(dirname(options.input), 'generated')
      workspace = dirname(dirname(options.input))
      const partialOutput = await readFile(
        join(staging, 'endpoints.ts'),
        'utf8',
      )
      expect(partialOutput).toContain('getApiV1Health')
      throw new Error('Injected Orval failure')
    })
    await expect(
      refreshContract({ check: false, url: openApiUrl, target }),
    ).rejects.toThrow('Injected Orval failure')
    expect(await readDirectoryContents(target)).toEqual(before)
    expect(workspace).toBeDefined()
    await expect(readdir(workspace!)).rejects.toMatchObject({ code: 'ENOENT' })
  }, 30_000)

  it('generates working success unions, status-specific errors, multipart metadata, and binary exclusions', async () => {
    const target = await createTargetDirectory()
    useContract(integrationContract)
    await refreshContract({ check: false, url: openApiUrl, target })
    const registry = await loadGeneratedRegistry(target)
    const successSchema =
      registry.endpointEnhancements.getApiV1Result.responseSchema
    expect(
      successSchema.parse({ id: 1, title: '📚📚📚', future: true }),
    ).toEqual({ id: 1, title: '📚📚📚' })
    expect(successSchema.parse({ ticket: 'pending-1' })).toEqual({
      ticket: 'pending-1',
    })
    expect(successSchema.safeParse({ id: 0, title: 'ok' }).success).toBe(false)
    expect(successSchema.safeParse({ id: 1, title: '📚📚📚📚' }).success).toBe(
      false,
    )
    expect(successSchema.safeParse({ error: 'not_found' }).success).toBe(false)
    const errors = registry.errorSchemas.getApiV1Result
    expect(Object.keys(errors).sort()).toEqual(['404', '409'])
    expect(errors['404'].parse({ error: 'not_found', future: true })).toEqual({
      error: 'not_found',
    })
    expect(errors['404'].safeParse({ error: 'conflict' }).success).toBe(false)
    expect(errors['409'].parse({ error: 'conflict' })).toEqual({
      error: 'conflict',
    })
    expect(registry.multipartEndpoints).toEqual(new Set(['createApiV1File']))
    expect(
      registry.endpointEnhancements.createApiV1File.responseSchema.safeParse({
        id: 1,
        title: 'ok',
      }).success,
    ).toBe(true)
    expect(registry.endpointEnhancements).not.toHaveProperty(
      'deleteApiV1Result',
    )
    expect(
      registry.errorSchemas.deleteApiV1Result['404'].safeParse({
        error: 'not_found',
      }).success,
    ).toBe(true)
    expect(registry.errorSchemas).not.toHaveProperty('getApiV1Pdf')
    expect(registry.errorSchemas).not.toHaveProperty('headApiV1Pdf')
    const endpoints = await readFile(join(target, 'endpoints.ts'), 'utf8')
    expect(endpoints).toContain('deleteApiV1Result: build.mutation')
    expect(endpoints).toContain('createApiV1File: build.mutation')
    expect(endpoints).toContain('file: Blob')
    expect(endpoints).not.toContain('getApiV1Pdf')
    expect(endpoints).not.toContain('headApiV1Pdf')
  }, 30_000)
})
