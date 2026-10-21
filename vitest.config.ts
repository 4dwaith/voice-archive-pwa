import { defineConfig } from 'vitest/config'

// Contract tests need Node's Fetch/File APIs, not React, PWA, or browser plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
