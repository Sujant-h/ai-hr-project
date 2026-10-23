import path from "path"
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Inline the built CSS into index.html as a <style> tag and drop the
// render-blocking <link rel="stylesheet">. This is a client-rendered SPA with a
// small (~6.6 KB gzipped) stylesheet, so shipping it inside the HTML removes a
// render-blocking round-trip on first paint with no FOUC — all CSS is present
// before the app mounts. Partial critical-CSS extraction is pointless here
// because the HTML shell is empty until React renders.
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html
        return html.replace(/<link\b[^>]*>/g, (tag) => {
          if (!/rel=["']stylesheet["']/.test(tag)) return tag
          const href = tag.match(/href=["']([^"']+\.css)["']/)?.[1]
          if (!href) return tag
          const key = href.replace(/^\//, '')
          const asset = bundle[key]
          if (!asset || asset.type !== 'asset') return tag
          const css =
            typeof asset.source === 'string'
              ? asset.source
              : Buffer.from(asset.source).toString('utf8')
          // The CSS now lives in the HTML; drop the standalone file.
          delete bundle[key]
          return `<style>${css}</style>`
        })
      },
    },
  }
}

// Self-hosted umami (vps-infra): nginx serves the tracker and its collect
// endpoint first-party under /u/, so no CSP exception is needed. Build only:
// the dev server has no /u/ route. data-domains keeps local previews out of
// the stats; search and hash are never sent, nor is anything the user types.
function umamiTracker(): Plugin {
  return {
    name: 'umami-tracker',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: '/u/s.js',
            'data-website-id': '16b245e8-b44e-46bd-8509-a6842c164bea',
            'data-host-url': '/u',
            'data-domains': 'hr-ai.suthaharan.de',
            'data-do-not-track': 'true',
            'data-exclude-search': 'true',
            'data-exclude-hash': 'true',
          },
          injectTo: 'head',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), inlineCss(), umamiTracker()],
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
