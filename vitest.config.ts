import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// These two read the shipped Supreme League data file, which needs the
// VITE_SL_SEED setting. A copy without it leaves them out and says so.
const SL_DATA_TESTS = ['tests/unit/sl/slData.test.ts', 'tests/unit/sl/team.test.ts']
const slSeeded = Boolean(
  loadEnv('test', fileURLToPath(new URL('.', import.meta.url)), 'VITE_SL_SEED').VITE_SL_SEED,
)
if (!slSeeded) console.log(`VITE_SL_SEED is not set, so ${SL_DATA_TESTS.join(' and ')} are skipped`)

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    globals: false, // Use explicit imports for describe/it/expect
    // Code under test logs its own rejection paths; that output only matters
    // when a test fails.
    silent: 'passed-only',
    exclude: slSeeded ? configDefaults.exclude : [...configDefaults.exclude, ...SL_DATA_TESTS],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
