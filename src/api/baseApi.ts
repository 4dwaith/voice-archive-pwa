import { createApi } from '@reduxjs/toolkit/query/react'
import { contractError, createArchiveBaseQuery } from './client.ts'

export const baseApi = createApi({
  reducerPath: 'archiveApi',
  baseQuery: createArchiveBaseQuery(
    import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
  ),
  catchSchemaFailure: contractError,
  endpoints: () => ({}),
})
