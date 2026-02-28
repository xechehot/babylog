import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [tanstackRouter(), react(), tailwindcss()],
  base: '/babylog/',
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['.ts.net'],
    proxy: {
      '/babylog/api': {
        target: 'http://localhost:3849',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/babylog\/api/, ''),
      },
    },
  },
})
