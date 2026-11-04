import { mergeConfig } from 'vite'
import config from './vite.config.ts'

// Keep the IDE browser on loopback with API requests on the same origin.
export default mergeConfig(config, {
  define: {
    'import.meta.env.VITE_API_BASE_URL': 'window.location.origin',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000' },
    },
  },
})
