import { generatedApi } from './generated/endpoints'
import { endpointEnhancements } from './generated/validation'

// One shared API/cache. Feature modules independently extend this instance and
// export their own typed endpoints/hooks; the store installs it only once.
export const archiveApi = generatedApi.enhanceEndpoints({
  endpoints: endpointEnhancements,
})
