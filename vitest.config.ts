import { defineConfig } from 'vitest/config'

// Contract tests need Node's Fetch/File APIs, not React, PWA, or browser plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/api-client/generated/**',
        '**/*.stories.*',
        'src/mock-data/**',
        '**/*.d.ts',
      ],
      reportsDirectory: 'coverage/vitest',
      reporter: ['json', 'text-summary'],
    },
  },
})
