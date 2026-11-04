import { createApi } from '@reduxjs/toolkit/query/react'
import { contractError, createArchiveBaseQuery } from './client.ts'

export const apiBaseUrl = new URL(
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
  globalThis.location?.origin,
).href

export const baseApi = createApi({
  reducerPath: 'archiveApi',
  baseQuery: createArchiveBaseQuery(apiBaseUrl),
  catchSchemaFailure: contractError,
  endpoints: () => ({}),
})
