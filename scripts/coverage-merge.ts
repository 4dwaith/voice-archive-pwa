import istanbulCoverage, { type CoverageMapData } from 'istanbul-lib-coverage'

const { createCoverageMap } = istanbulCoverage

// Vitest retains implicit else locations which browser source-map remapping may
// omit. Start with that complete map before merging Cypress's partial map.
// nyc merge reads files concurrently; its merge order is not deterministic.
export function mergeFrontendCoverage(
  vitest: CoverageMapData,
  cypress: CoverageMapData,
) {
  const combined = createCoverageMap(vitest)
  combined.merge(cypress)
  for (const input of [vitest, cypress]) {
    const original = createCoverageMap(input)
    for (const file of original.files()) {
      const before = original.fileCoverageFor(file).toSummary()
      const after = combined.fileCoverageFor(file).toSummary()
      for (const metric of ['statements', 'functions', 'branches'] as const) {
        if (
          after[metric].total < before[metric].total ||
          after[metric].covered < before[metric].covered
        ) {
          throw new Error(
            `Coverage merge lost ${metric} data for ${file}; review instrumentation compatibility`,
          )
        }
      }
    }
  }
  return combined.toJSON()
}
