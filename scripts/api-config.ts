import { resolve } from 'node:path'
import type { generateEndpoints } from '@rtk-query/codegen-openapi'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { Options } from 'orval'

export const openApiUrl =
  process.env.OPENAPI_URL ?? 'http://127.0.0.1:8000/openapi.json'

type RtkGeneratorOptions = Parameters<typeof generateEndpoints>[0]
type ApiOperation = Pick<
  OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject,
  'responses'
>

// Classify by successful responses, not the request body: a multipart upload
// returns JSON metadata and belongs in RTK, whereas a PDF download does not.
export function isJsonOrBodylessOperation(operation: {
  verb: string
  operation: ApiOperation
}): boolean {
  // HEAD has no JSON body to validate; file headers remain a transport concern.
  if (operation.verb === 'head') return false

  const responses = operation.operation.responses ?? {}
  for (const [status, response] of Object.entries(responses)) {
    const isSuccessfulResponse = /^2\d\d$/.test(status)
    if (!isSuccessfulResponse) continue

    // A response without content (for example DELETE's 204) is supported.
    const content = 'content' in response ? response.content : undefined
    const mediaTypes = Object.keys(content ?? {})
    const returnsNonJsonContent = mediaTypes.some(
      (mediaType) => mediaType !== 'application/json',
    )
    if (returnsNonJsonContent) return false
  }
  return true
}

export function rtkConfig(schemaFile: string): RtkGeneratorOptions {
  return {
    schemaFile,
    // Omit outputFile so the generator returns source in memory. This import
    // then stays relative to the final file, independent of OS temp paths.
    apiFile: '../baseApi.ts',
    apiImport: 'baseApi',
    exportName: 'generatedApi',
    hooks: true,
    // TODO Custom cache behavior is deferred to later
    tag: false,
    // BookResponse's computed delivery URLs are readOnly. Keep a single model
    // that includes them instead of separate BookResponse/BookResponseRead types.
    mergeReadWriteOnly: true,
    // Empty schemas must not silently disable TypeScript checks through the 'any' keyword.
    useUnknown: true,
    filterEndpoints: (_name, operation) => isJsonOrBodylessOperation(operation),
  }
}

export function zodConfig(schemaFile: string, directory: string): Options {
  const schemaOutputFile = resolve(directory, 'schemas.ts')
  return {
    input: schemaFile,
    output: {
      target: schemaOutputFile,
      // Generate validators only; RTK already generates the HTTP endpoints.
      client: 'zod',
      mode: 'single',
      override: {
        zod: {
          // Explicit choices avoid output changing with package auto-detection.
          version: 4,
          variant: 'classic',
          // Define BookResponse once and reference it from operation validators.
          generateReusableSchemas: true,
          // Infer input/output types from the generated validators.
          generateCompanionTypes: true,
          // A 201 success and a 422 error have different payload contracts.
          generateEachHttpStatus: true,
          // Accept RFC 3339 offsets as well as Z; timestamps remain strings.
          dateTimeOptions: { offset: true },
          generate: { response: true, body: true, query: true, param: true },
          // Reject a numeric string where OpenAPI requires a number, rather
          // than converting it and hiding a server/client mismatch.
          coerce: { response: false, body: false, query: false, param: false },
          // With the generated object schemas this accepts and strips unknown
          // response fields, allowing additive backend changes.
          strict: { response: false },
        },
      },
    },
  }
}
