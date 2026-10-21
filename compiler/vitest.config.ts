import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // simulate-based cases opt in per-file via `// @vitest-environment jsdom`
    testTimeout: 20000,
  },
})
