// GENERATED FILE. Run npm run api:regenerate; do not edit.

import * as schemas from './schemas'
import type { ZodType } from 'zod'

export const endpointEnhancements = {
  listApiV1Books: { responseSchema: schemas.ListApiV1Books200Response },
  createApiV1Book: { responseSchema: schemas.CreateApiV1Book201Response },
  getApiV1Book: { responseSchema: schemas.GetApiV1Book200Response },
  patchApiV1Book: { responseSchema: schemas.PatchApiV1Book200Response },
  importApiV1BookContent: {
    responseSchema: schemas.ImportApiV1BookContent200Response,
  },
  getApiV1BookContent: {
    responseSchema: schemas.GetApiV1BookContent200Response,
  },
  createApiV1File: { responseSchema: schemas.CreateApiV1File201Response },
  getApiV1Health: { responseSchema: schemas.GetApiV1Health200Response },
  getApiV1Ready: { responseSchema: schemas.GetApiV1Ready200Response },
}
export const errorSchemas: Record<string, Record<string, ZodType>> = {
  listApiV1Books: {
    '405': schemas.ListApiV1Books405Response,
    '422': schemas.ListApiV1Books422Response,
    '500': schemas.ListApiV1Books500Response,
  },
  createApiV1Book: {
    '404': schemas.CreateApiV1Book404Response,
    '405': schemas.CreateApiV1Book405Response,
    '409': schemas.CreateApiV1Book409Response,
    '422': schemas.CreateApiV1Book422Response,
    '500': schemas.CreateApiV1Book500Response,
  },
  getApiV1Book: {
    '404': schemas.GetApiV1Book404Response,
    '405': schemas.GetApiV1Book405Response,
    '422': schemas.GetApiV1Book422Response,
    '500': schemas.GetApiV1Book500Response,
  },
  patchApiV1Book: {
    '404': schemas.PatchApiV1Book404Response,
    '405': schemas.PatchApiV1Book405Response,
    '409': schemas.PatchApiV1Book409Response,
    '422': schemas.PatchApiV1Book422Response,
    '500': schemas.PatchApiV1Book500Response,
  },
  deleteApiV1Book: {
    '404': schemas.DeleteApiV1Book404Response,
    '405': schemas.DeleteApiV1Book405Response,
    '422': schemas.DeleteApiV1Book422Response,
    '500': schemas.DeleteApiV1Book500Response,
  },
  importApiV1BookContent: {
    '404': schemas.ImportApiV1BookContent404Response,
    '405': schemas.ImportApiV1BookContent405Response,
    '409': schemas.ImportApiV1BookContent409Response,
    '413': schemas.ImportApiV1BookContent413Response,
    '422': schemas.ImportApiV1BookContent422Response,
    '500': schemas.ImportApiV1BookContent500Response,
  },
  getApiV1BookContent: {
    '404': schemas.GetApiV1BookContent404Response,
    '405': schemas.GetApiV1BookContent405Response,
    '422': schemas.GetApiV1BookContent422Response,
    '500': schemas.GetApiV1BookContent500Response,
  },
  purgeApiV1BookContent: {
    '404': schemas.PurgeApiV1BookContent404Response,
    '405': schemas.PurgeApiV1BookContent405Response,
    '412': schemas.PurgeApiV1BookContent412Response,
    '422': schemas.PurgeApiV1BookContent422Response,
    '428': schemas.PurgeApiV1BookContent428Response,
    '500': schemas.PurgeApiV1BookContent500Response,
  },
  createApiV1File: {
    '400': schemas.CreateApiV1File400Response,
    '405': schemas.CreateApiV1File405Response,
    '413': schemas.CreateApiV1File413Response,
    '415': schemas.CreateApiV1File415Response,
    '422': schemas.CreateApiV1File422Response,
    '500': schemas.CreateApiV1File500Response,
  },
  deleteApiV1File: {
    '404': schemas.DeleteApiV1File404Response,
    '405': schemas.DeleteApiV1File405Response,
    '409': schemas.DeleteApiV1File409Response,
    '422': schemas.DeleteApiV1File422Response,
    '500': schemas.DeleteApiV1File500Response,
  },
  getApiV1Health: {
    '405': schemas.GetApiV1Health405Response,
    '500': schemas.GetApiV1Health500Response,
  },
  getApiV1Ready: {
    '405': schemas.GetApiV1Ready405Response,
    '500': schemas.GetApiV1Ready500Response,
    '503': schemas.GetApiV1Ready503Response,
  },
}
export const multipartEndpoints = new Set<string>(['createApiV1File'])
