import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
  type FetchBaseQueryMeta,
} from '@reduxjs/toolkit/query'
import { errorSchemas, multipartEndpoints } from './generated/validation'

type ArchiveQueryExtraOptions = {
  errorSchemaEndpoint?: string
}

export function contractError(): FetchBaseQueryError {
  console.error('Voice Archive: API response contract validation failed.')
  return {
    status: 'CUSTOM_ERROR',
    error: 'The API response did not match its contract.',
    data: { code: 'response_contract_error' },
  }
}

export function createArchiveBaseQuery(baseUrl: string) {
  const fetchQuery = fetchBaseQuery({ baseUrl })
  const query: BaseQueryFn<
    string | FetchArgs,
    unknown,
    FetchBaseQueryError,
    ArchiveQueryExtraOptions,
    FetchBaseQueryMeta
  > = async (args, api, extraOptions) => {
    let request = typeof args === 'string' ? { url: args } : args
    if (multipartEndpoints.has(api.endpoint)) {
      // Generated upload arguments contain Blob/File values. Let fetch supply
      // Content-Type and its boundary; never JSON-encode multipart bodies.
      const form = new FormData()
      for (const [name, value] of Object.entries(request.body ?? {})) {
        if (!(value instanceof Blob)) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: 'Multipart file fields must contain a File or Blob.',
            },
          }
        }
        form.append(name, value)
      }
      request = { ...request, body: form }
    }
    const result = await fetchQuery(request, api, extraOptions)
    if (result.error && typeof result.error.status === 'number') {
      const endpoint = extraOptions?.errorSchemaEndpoint ?? api.endpoint
      const schema = errorSchemas[endpoint]?.[result.error.status]
      if (schema) {
        const parsed = schema.safeParse(result.error.data)
        if (!parsed.success)
          return { error: contractError(), meta: result.meta }
        return {
          error: { ...result.error, data: parsed.data },
          meta: result.meta,
        }
      }
    }
    return result
  }
  return query
}
