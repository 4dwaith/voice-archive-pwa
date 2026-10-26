import type { FetchArgs } from '@reduxjs/toolkit/query'
import { archiveApi } from '../../src/api-client/archiveApi'
import { apiBaseUrl } from '../../src/api-client/baseApi'
import type {
  GetApiV1BookContentApiArg,
  ListApiV1BookSectionsApiArg,
  ListApiV1BookSegmentsApiArg,
} from '../../src/api-client/generated/endpoints'

type QueryBuilder<Argument> = (argument: Argument) => string | FetchArgs

function throwMissingQueryBuilder(): never {
  throw new Error('Generated content endpoint has no query builder')
}

let buildManifestRequest: QueryBuilder<GetApiV1BookContentApiArg> =
  throwMissingQueryBuilder
let buildSectionsRequest: QueryBuilder<ListApiV1BookSectionsApiArg> =
  throwMissingQueryBuilder
let buildSegmentsRequest: QueryBuilder<ListApiV1BookSegmentsApiArg> =
  throwMissingQueryBuilder

// Read the generated definitions through RTK's endpoint enhancement callbacks.
// These callbacks only capture query functions; they change no endpoint options
// and send no requests. No path templates are duplicated in the test code.
archiveApi.enhanceEndpoints({
  endpoints: {
    getApiV1BookContent(definition) {
      if (!definition.query) throwMissingQueryBuilder()
      buildManifestRequest = definition.query
    },
    listApiV1BookSections(definition) {
      if (!definition.query) throwMissingQueryBuilder()
      buildSectionsRequest = definition.query
    },
    listApiV1BookSegments(definition) {
      if (!definition.query) throwMissingQueryBuilder()
      buildSegmentsRequest = definition.query
    },
  },
})

function getRequestPathname(request: string | FetchArgs) {
  return new URL(
    typeof request === 'string' ? request : request.url,
    apiBaseUrl,
  ).pathname
}

export function getContentApiPaths(bookId: number, contentVersion: string) {
  const collectionArguments = { bookId, 'if-content-version': contentVersion }

  return {
    manifest: getRequestPathname(buildManifestRequest({ bookId })),
    sections: getRequestPathname(buildSectionsRequest(collectionArguments)),
    segments: getRequestPathname(buildSegmentsRequest(collectionArguments)),
  }
}
