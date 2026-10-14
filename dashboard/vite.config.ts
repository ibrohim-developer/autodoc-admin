/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Mirrors the `@/*` path in tsconfig.json — keep the two in sync.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // In production nginx serves the dashboard and the API from one origin; the
    // dev server mimics that, so session cookies behave the same in both.
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:4000' },
      // Uploaded photos, served by the API (by nginx in production). With the slash, so a
      // dashboard route that merely starts with "media" is not sent to the API.
      '/media/': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:4000' },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Vitest's default include matches *.spec.ts, which would swallow the
    // Playwright specs in e2e/. They are run by `pnpm e2e`, not Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        ...(configDefaults.coverage.exclude ?? []),
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        '**/*.config.ts',
      ],
    },
  },
})
