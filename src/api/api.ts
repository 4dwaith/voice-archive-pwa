import { generatedApi } from './generated/endpoints'
import { endpointEnhancements } from './generated/validation'

// Import this enhanced API in application code. The schema associations are
// generated from response statuses, so new JSON endpoints cannot silently
// bypass validation. Future per-endpoint behavior belongs in this object.
export const api = generatedApi.enhanceEndpoints({
  endpoints: endpointEnhancements,
})
