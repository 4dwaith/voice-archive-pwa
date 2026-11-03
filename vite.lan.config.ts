import { mergeConfig } from 'vite'
import config from './vite.config.ts'

// Keep the IDE and device browser on the same API origin.
export default mergeConfig(config, {
  define: {
    'import.meta.env.VITE_API_BASE_URL': 'window.location.origin',
  },
  server: {
    host: '192.168.18.22',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000' },
    },
  },
})
