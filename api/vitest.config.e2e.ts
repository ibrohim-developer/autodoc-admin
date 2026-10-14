import { defineConfig } from 'vitest/config'

// End-to-end specs boot the whole app against a throwaway Postgres cluster that
// test/global-setup.ts starts once for the run.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // One app and one database: specs share them, so they must not run in parallel.
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
})
