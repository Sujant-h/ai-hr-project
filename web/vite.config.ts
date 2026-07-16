import path from "path"
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Function form: Vite 8's Rolldown types manualChunks as a function,
        // not the object map. Keeps React and the router in one vendor chunk
        // shared across the lazy route chunks.
        manualChunks(id: string) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(id)) {
            return 'react';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  }
})
