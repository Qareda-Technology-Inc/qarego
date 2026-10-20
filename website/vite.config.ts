import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Same path Vercel rewrites to the API in production (see vercel.json).
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:2026',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
