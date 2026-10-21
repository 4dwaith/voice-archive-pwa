import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateEndpoints } from '@rtk-query/codegen-openapi'
import { generate } from 'orval'
import { format, resolveConfig } from 'prettier'
import type { OpenAPIV3_1 } from 'openapi-types'
import ts from 'typescript'
import { unicodeStringLengths } from './zod-unicode.ts'
import {
  isJsonOrBodylessOperation,
  rtkConfig,
  zodConfig,
} from './api-config.ts'

type BackendOpenApiDocument = OpenAPIV3_1.Document & {
  paths: OpenAPIV3_1.PathsObject
  components: OpenAPIV3_1.ComponentsObject
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Only the envelope is checked here; the generators validate the OpenAPI input.
function isBackendOpenApiDocument(
  value: unknown,
): value is BackendOpenApiDocument {
  return (
    isRecord(value) &&
    value.openapi === '3.1.0' &&
    isRecord(value.paths) &&
    isRecord(value.components)
  )
}

export const projectRoot = fileURLToPath(new URL('../', import.meta.url))
export const generatedDirectory = join(projectRoot, 'src/api/generated')
const header = '// GENERATED FILE. Run npm run api:regenerate; do not edit.\n'
const methods = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
] as const

// RTK's generator recognizes format: binary, but not OpenAPI 3.1's equivalent
// contentMediaType representation. Apply this hint only to temporary input.
export function normalizeForGenerators<T>(document: T): T {
  const normalized = structuredClone(document)
  function visit(node: unknown): void {
    if (!node || typeof node !== 'object') return
    const isStringSchema = 'type' in node && node.type === 'string'
    const describesBinaryContent =
      'contentMediaType' in node &&
      node.contentMediaType === 'application/octet-stream'
    if (isStringSchema && describesBinaryContent) {
      Object.assign(node, { format: 'binary' })
    }
    for (const value of Object.values(node)) visit(value)
  }
  visit(normalized)
  return normalized
}

// Both tools use PascalCase/camelCase for the backend's stable snake_case IDs.
function operationNames(operationId: string): {
  pascal: string
  camel: string
} {
  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(operationId)) {
    throw new Error(`Unsupported operationId naming: ${operationId}`)
  }
  const words = operationId.split('_')
  const capitalizedWords = words.map(
    (word) => word[0].toUpperCase() + word.slice(1),
  )
  const pascal = capitalizedWords.join('')
  const camel = pascal[0].toLowerCase() + pascal.slice(1)
  return { pascal, camel }
}

// A success with several JSON status codes must accept each declared shape.
// Errors instead keep separate schemas indexed by status in the shared transport.
function successSchemaExpression(schemas: ts.Expression[]): ts.Expression {
  if (schemas.length === 1) return schemas[0]
  const unionFunction = ts.factory.createPropertyAccessExpression(
    ts.factory.createIdentifier('z'),
    'union',
  )
  const schemaArray = ts.factory.createArrayLiteralExpression(schemas)
  return ts.factory.createCallExpression(unionFunction, undefined, [
    schemaArray,
  ])
}

type RegistryEntries = {
  enhancements: ts.PropertyAssignment[]
  errors: ts.PropertyAssignment[]
  multipart: ts.StringLiteral[]
  needsUnion: boolean
}

function collectRegistryEntries(
  document: BackendOpenApiDocument,
): RegistryEntries {
  const factory = ts.factory
  const enhancements: ts.PropertyAssignment[] = []
  const errors: ts.PropertyAssignment[] = []
  const multipart: ts.StringLiteral[] = []
  let needsUnion = false
  const seenIds = new Set<string>()
  for (const pathItem of Object.values(document.paths)) {
    if (!pathItem) continue
    for (const method of methods) {
      const operation = pathItem[method]
      if (!operation) continue
      if (!operation.operationId || seenIds.has(operation.operationId)) {
        throw new Error('All operations need unique explicit operationIds')
      }
      seenIds.add(operation.operationId)
      if (!isJsonOrBodylessOperation({ verb: method, operation })) continue
      const { camel: endpointName, pascal: schemaPrefix } = operationNames(
        operation.operationId,
      )
      const successSchemas: ts.Expression[] = []
      const errorSchemaProperties: ts.PropertyAssignment[] = []
      const responses = operation.responses ?? {}
      for (const [status, response] of Object.entries(responses)) {
        const content = 'content' in response ? response.content : undefined
        const returnsJson = Boolean(content?.['application/json'])
        if (!returnsJson) continue
        if (!/^\d{3}$/.test(status)) {
          throw new Error(
            `An explicit status is required: ${operation.operationId}`,
          )
        }
        const schemaName = `${schemaPrefix}${status}Response`
        const schemaReference = factory.createPropertyAccessExpression(
          factory.createIdentifier('schemas'),
          schemaName,
        )
        const isSuccessfulResponse = /^2/.test(status)
        if (isSuccessfulResponse) {
          successSchemas.push(schemaReference)
        } else {
          const statusKey = factory.createStringLiteral(status)
          const errorSchemaProperty = factory.createPropertyAssignment(
            statusKey,
            schemaReference,
          )
          errorSchemaProperties.push(errorSchemaProperty)
        }
      }
      if (successSchemas.length > 0) {
        const responseSchema = successSchemaExpression(successSchemas)
        const responseSchemaProperty = factory.createPropertyAssignment(
          'responseSchema',
          responseSchema,
        )
        const endpointOptions = factory.createObjectLiteralExpression([
          responseSchemaProperty,
        ])
        const endpointEnhancement = factory.createPropertyAssignment(
          endpointName,
          endpointOptions,
        )
        enhancements.push(endpointEnhancement)
        needsUnion ||= successSchemas.length > 1
      }
      const errorsByStatus = factory.createObjectLiteralExpression(
        errorSchemaProperties,
        true,
      )
      errors.push(
        factory.createPropertyAssignment(endpointName, errorsByStatus),
      )

      const requestBody = operation.requestBody
      const requestContent =
        requestBody && 'content' in requestBody
          ? requestBody.content
          : undefined
      const acceptsMultipart = Boolean(requestContent?.['multipart/form-data'])
      if (acceptsMultipart) {
        multipart.push(factory.createStringLiteral(endpointName))
      }
    }
  }
  return { enhancements, errors, multipart, needsUnion }
}

function createRegistryStatements({
  enhancements,
  errors,
  multipart,
  needsUnion,
}: RegistryEntries): ts.Statement[] {
  const factory = ts.factory
  // Build syntax nodes rather than code strings: IDEs must not inspect the
  // generated module as executable source inside this generator.
  function namespaceImport(name: string, module: string): ts.ImportDeclaration {
    const namespaceBinding = factory.createNamespaceImport(
      factory.createIdentifier(name),
    )
    const isTypeOnlyImport = false // Validators must be available at runtime.
    const importClause = factory.createImportClause(
      isTypeOnlyImport,
      undefined,
      namespaceBinding,
    )
    const modulePath = factory.createStringLiteral(module)
    return factory.createImportDeclaration(undefined, importClause, modulePath)
  }
  function exportConstant(
    name: string,
    value: ts.Expression,
    type?: ts.TypeNode,
  ): ts.VariableStatement {
    const declaration = factory.createVariableDeclaration(
      name,
      undefined,
      type,
      value,
    )
    const declarationList = factory.createVariableDeclarationList(
      [declaration],
      ts.NodeFlags.Const,
    )
    const exportModifier = factory.createModifier(ts.SyntaxKind.ExportKeyword)
    return factory.createVariableStatement([exportModifier], declarationList)
  }
  const stringType = () =>
    factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
  const record = (value: ts.TypeNode) =>
    factory.createTypeReferenceNode('Record', [stringType(), value])
  const zodTypeBinding = factory.createImportSpecifier(
    false,
    undefined,
    factory.createIdentifier('ZodType'),
  )
  const zodTypeImports = factory.createNamedImports([zodTypeBinding])
  const typeOnlyImportClause = factory.createImportClause(
    true,
    undefined,
    zodTypeImports,
  )
  const zodTypeImport = factory.createImportDeclaration(
    undefined,
    typeOnlyImportClause,
    factory.createStringLiteral('zod'),
  )
  const endpointEnhancements = factory.createObjectLiteralExpression(
    enhancements,
    true,
  )
  const errorSchemas = factory.createObjectLiteralExpression(errors, true)
  // The outer record is keyed by endpoint name, the inner record by HTTP status.
  const errorSchemaType = record(
    record(factory.createTypeReferenceNode('ZodType')),
  )
  const multipartEndpointArray = factory.createArrayLiteralExpression(multipart)
  const multipartEndpointSet = factory.createNewExpression(
    factory.createIdentifier('Set'),
    [stringType()],
    [multipartEndpointArray],
  )
  return [
    namespaceImport('schemas', './schemas'),
    zodTypeImport,
    ...(needsUnion ? [namespaceImport('z', 'zod')] : []),
    exportConstant('endpointEnhancements', endpointEnhancements),
    exportConstant('errorSchemas', errorSchemas, errorSchemaType),
    exportConstant('multipartEndpoints', multipartEndpointSet),
  ]
}

function registrySource(document: BackendOpenApiDocument): string {
  const registryEntries = collectRegistryEntries(document)
  const statements = createRegistryStatements(registryEntries)
  const file = ts.createSourceFile('validation.ts', '', ts.ScriptTarget.Latest)
  const printer = ts.createPrinter()
  const print = (statement: ts.Statement): string =>
    printer.printNode(ts.EmitHint.Unspecified, statement, file)
  const imports = statements.filter(ts.isImportDeclaration)
  const declarations = statements.filter(
    (statement) => !ts.isImportDeclaration(statement),
  )
  const importSource = imports.map(print).join('\n')
  const declarationSource = declarations.map(print).join('\n')
  return [header, importSource, '', declarationSource, ''].join('\n')
}

export async function generateContract(
  document: BackendOpenApiDocument,
  directory: string,
): Promise<void> {
  await mkdir(directory, { recursive: true })
  const openApiFile = join(dirname(directory), 'openapi.json')
  const endpointFile = join(directory, 'endpoints.ts')
  const schemaFile = join(directory, 'schemas.ts')
  const validationFile = join(directory, 'validation.ts')

  // One fetch supplies exactly the same normalized document to both generators.
  const compatibleDocument = normalizeForGenerators(document)
  const openApiSource = JSON.stringify(compatibleDocument)
  await writeFile(openApiFile, openApiSource)

  const endpointConfiguration = rtkConfig(openApiFile)
  const endpointSource = await generateEndpoints(endpointConfiguration)
  if (typeof endpointSource !== 'string')
    throw new Error('RTK generator returned no source')
  await writeFile(endpointFile, endpointSource)

  const schemaConfiguration = zodConfig(openApiFile, directory)
  // Orval can otherwise log generation failures without rejecting the promise.
  // Reject so a failed generation never replaces the tracked output.
  await generate(schemaConfiguration, projectRoot, {
    throwOnError: true,
  })
  const generatedSchemaSource = await readFile(schemaFile, 'utf8')
  const unicodeCompatibleSource = unicodeStringLengths(generatedSchemaSource)
  await writeFile(schemaFile, unicodeCompatibleSource)

  const validationSource = registrySource(document)
  await writeFile(validationFile, validationSource)
  await formatGeneratedFiles(directory)
}

async function formatGeneratedFiles(directory: string): Promise<void> {
  const prettierConfigFile = join(projectRoot, '.prettierrc.json')
  const prettierOptions = await resolveConfig(prettierConfigFile)
  const fileNames = await readdir(directory)
  for (const fileName of fileNames) {
    const filePath = join(directory, fileName)
    const source = await readFile(filePath, 'utf8')
    const markedSource = source.startsWith(header) ? source : header + source
    // Use the project formatter, including in check mode, so formatting the
    // project later cannot make freshly generated files appear stale.
    const formattedSource = await format(markedSource, {
      ...prettierOptions,
      parser: 'typescript',
    })
    await writeFile(filePath, formattedSource)
  }
}

export async function compareGenerated(
  expected: string,
  actual: string,
): Promise<string[]> {
  const expectedFiles = await readdir(expected)
  const actualFiles = await readdir(actual).catch(
    (error: unknown): string[] => {
      if (isRecord(error) && error.code === 'ENOENT') return []
      throw error
    },
  )
  const differences: string[] = []
  // The union also detects missing and obsolete files, not just edited ones.
  const allFileNames = new Set([...expectedFiles, ...actualFiles])
  for (const name of allFileNames) {
    const expectedText = expectedFiles.includes(name)
      ? await readFile(join(expected, name), 'utf8')
      : null
    const actualText = actualFiles.includes(name)
      ? await readFile(join(actual, name), 'utf8')
      : null
    const fileIsDifferent = expectedText !== actualText
    if (fileIsDifferent) differences.push(name)
  }
  return differences.sort()
}

async function fetchOpenApiDocument(
  url: string,
): Promise<BackendOpenApiDocument> {
  const timeoutSignal = AbortSignal.timeout(15_000)
  const response = await fetch(url, { signal: timeoutSignal })
  if (!response.ok)
    throw new Error(`OpenAPI fetch failed: HTTP ${response.status}`)
  const document: unknown = await response.json()
  if (!isBackendOpenApiDocument(document)) {
    throw new Error('Expected the backend OpenAPI 3.1 document')
  }
  return document
}

async function createGenerationWorkspace(): Promise<string> {
  const temporaryPrefix = join(tmpdir(), 'voice-archive-api-')
  const temporaryRoot = await mkdtemp(temporaryPrefix)
  const isInsideSystemTemp =
    dirname(resolve(temporaryRoot)) === resolve(tmpdir())
  const hasExpectedName =
    basename(temporaryRoot).startsWith('voice-archive-api-')
  // Cleanup recursively deletes this directory. Verify its boundary first.
  if (!isInsideSystemTemp || !hasExpectedName) {
    throw new Error('Generation temporary directory escaped its expected root')
  }
  return temporaryRoot
}

async function replaceGeneratedFiles(
  staging: string,
  target: string,
): Promise<void> {
  await mkdir(target, { recursive: true })
  const stagedFileNames = await readdir(staging)
  const existingFileNames = await readdir(target)
  const obsoleteGeneratedFiles: string[] = []

  // Remove obsolete output only when our marker proves it was generated.
  // Inspect the whole directory before deleting anything: discovering an
  // unfamiliar file must leave earlier marked obsolete files intact too.
  for (const fileName of existingFileNames) {
    if (stagedFileNames.includes(fileName)) continue
    const filePath = resolve(target, fileName)
    const source = await readFile(filePath, 'utf8')
    const isGeneratedFile = source.startsWith(header)
    if (isGeneratedFile) obsoleteGeneratedFiles.push(filePath)
    else
      throw new Error(`Unrecognized file in generated directory: ${fileName}`)
  }

  for (const filePath of obsoleteGeneratedFiles) {
    await rm(filePath)
  }

  for (const fileName of stagedFileNames) {
    const stagedFile = join(staging, fileName)
    const targetFile = join(target, fileName)
    const source = await readFile(stagedFile)
    await writeFile(targetFile, source)
  }
}

export async function refreshContract({
  check,
  url,
  target = generatedDirectory,
}: {
  check: boolean
  url: string
  target?: string
}): Promise<string[]> {
  const document = await fetchOpenApiDocument(url)
  const temporaryRoot = await createGenerationWorkspace()
  try {
    const stagingDirectory = join(temporaryRoot, 'api/generated')
    await generateContract(document, stagingDirectory)
    const differences = await compareGenerated(stagingDirectory, target)

    // Both modes generate in isolation. Only explicit write mode touches the
    // target, and only after every generation/formatting step has succeeded.
    if (check) return differences
    await replaceGeneratedFiles(stagingDirectory, target)
    return differences
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
