import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { defineConfig } from 'cypress'
import createBundler from '@bahmutov/cypress-esbuild-preprocessor'
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor'
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild'

const require = createRequire(import.meta.url)

export default defineConfig({
  video: true,
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  screenshotsFolder: 'cypress/artifacts/screenshots',
  videosFolder: 'cypress/artifacts/videos',
  viewportWidth: 1100,
  viewportHeight: 800,
  retries: 0,
  e2e: {
    baseUrl: 'http://127.0.0.1:5174',
    specPattern: 'cypress/e2e/**/*.feature',
    supportFile: 'cypress/support/e2e.ts',
    async setupNodeEvents(on, config) {
      await addCucumberPreprocessorPlugin(on, config)
      on(
        'file:preprocessor',
        createBundler({
          plugins: [createEsbuildPlugin(config)],
        }),
      )
      if (config.expose.coverage) {
        require('@cypress/code-coverage/task')(on, config)
      }
      on('after:spec', async (_spec, results) => {
        if (results?.video && results.stats.failures === 0) {
          await rm(results.video, { force: true })
        }
      })
      return config
    },
  },
})
