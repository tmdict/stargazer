import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    globals: false, // Use explicit imports for describe/it/expect
    // Code under test logs its own rejection paths; that output only matters
    // when a test fails.
    silent: 'passed-only',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
