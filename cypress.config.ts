import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { defineConfig } from 'cypress'
import createBundler from '@bahmutov/cypress-esbuild-preprocessor'
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor'
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import istanbul from 'vite-plugin-istanbul'

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
  component: {
    specPattern: 'cypress/component/**/*.cy.tsx',
    supportFile: 'cypress/support/component.tsx',
    indexHtmlFile: 'cypress/support/component-index.html',
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: {
        define: {
          'import.meta.env.VITE_READER_PREFERENCES_KEY': JSON.stringify(
            'voice-archive-reader-component-test',
          ),
          'import.meta.env.VITE_DATABASE_NAME': JSON.stringify(
            'voice-archive-component-test',
          ),
        },
        plugins: [
          react(),
          tailwindcss(),
          ...(process.env.VITE_COVERAGE === 'true'
            ? [
                istanbul({
                  include: ['src/**/*.{ts,tsx}'],
                  exclude: [
                    'src/api-client/generated/**',
                    '**/*.stories.*',
                    'src/mock-data/**',
                    '**/*.d.ts',
                  ],
                  extension: ['.ts', '.tsx'],
                }),
              ]
            : []),
        ],
      },
    },
    setupNodeEvents(on, config) {
      if (process.env.VITE_COVERAGE === 'true')
        require('@cypress/code-coverage/task')(on, config)
      return config
    },
  },
  e2e: {
    baseUrl: 'http://127.0.0.1:5174',
    specPattern: 'cypress/e2e/**/*.feature',
    supportFile: 'cypress/support/e2e.ts',
    async setupNodeEvents(on, config) {
      await addCucumberPreprocessorPlugin(on, config)
      on(
        'file:preprocessor',
        createBundler({
          define: {
            'import.meta.env.VITE_READER_PREFERENCES_KEY': JSON.stringify(
              process.env.VITE_READER_PREFERENCES_KEY ||
                'voice-archive-reader-e2e-test',
            ),
          },
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
