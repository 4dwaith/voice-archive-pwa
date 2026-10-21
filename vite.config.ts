import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import istanbul from 'vite-plugin-istanbul'

export default defineConfig({
  build: { sourcemap: process.env.VITE_COVERAGE === 'true' },
  plugins: [
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
            checkProd: true,
          }),
        ]
      : []),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Voice Archive',
        short_name: 'Voice Archive',
        description: 'A personal, voice-first assistant and archive.',
        theme_color: '#f4f1e8',
        background_color: '#f4f1e8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg}'],
      },
    }),
  ],
})
