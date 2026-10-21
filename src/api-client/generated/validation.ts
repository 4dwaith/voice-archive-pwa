// GENERATED FILE. Run npm run api:regenerate; do not edit.

import * as schemas from './schemas'
import type { ZodType } from 'zod'

export const endpointEnhancements = {
  listApiV1Books: { responseSchema: schemas.ListApiV1Books200Response },
  createApiV1Book: { responseSchema: schemas.CreateApiV1Book201Response },
  getApiV1Book: { responseSchema: schemas.GetApiV1Book200Response },
  patchApiV1Book: { responseSchema: schemas.PatchApiV1Book200Response },
  createApiV1CoverFile: {
    responseSchema: schemas.CreateApiV1CoverFile201Response,
  },
  createApiV1SourcePdfFile: {
    responseSchema: schemas.CreateApiV1SourcePdfFile201Response,
  },
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
  createApiV1CoverFile: {
    '400': schemas.CreateApiV1CoverFile400Response,
    '405': schemas.CreateApiV1CoverFile405Response,
    '413': schemas.CreateApiV1CoverFile413Response,
    '415': schemas.CreateApiV1CoverFile415Response,
    '422': schemas.CreateApiV1CoverFile422Response,
    '500': schemas.CreateApiV1CoverFile500Response,
  },
  deleteApiV1CoverFile: {
    '404': schemas.DeleteApiV1CoverFile404Response,
    '405': schemas.DeleteApiV1CoverFile405Response,
    '409': schemas.DeleteApiV1CoverFile409Response,
    '422': schemas.DeleteApiV1CoverFile422Response,
    '500': schemas.DeleteApiV1CoverFile500Response,
  },
  createApiV1SourcePdfFile: {
    '400': schemas.CreateApiV1SourcePdfFile400Response,
    '405': schemas.CreateApiV1SourcePdfFile405Response,
    '413': schemas.CreateApiV1SourcePdfFile413Response,
    '422': schemas.CreateApiV1SourcePdfFile422Response,
    '500': schemas.CreateApiV1SourcePdfFile500Response,
  },
  deleteApiV1SourcePdfFile: {
    '404': schemas.DeleteApiV1SourcePdfFile404Response,
    '405': schemas.DeleteApiV1SourcePdfFile405Response,
    '409': schemas.DeleteApiV1SourcePdfFile409Response,
    '422': schemas.DeleteApiV1SourcePdfFile422Response,
    '500': schemas.DeleteApiV1SourcePdfFile500Response,
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
export const multipartEndpoints = new Set<string>([
  'createApiV1CoverFile',
  'createApiV1SourcePdfFile',
])
