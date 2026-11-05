import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

// These read the PvP data, which comes with the data pack. A copy without it
// leaves them out and says so.
const PVP_DATA_TESTS = [
  'tests/unit/content/pvpSeasons.test.ts',
  'tests/unit/sl/slData.test.ts',
  'tests/unit/sl/team.test.ts',
]
const keyFile = statSync(new URL('./src/pack/pvp/pvp.key', import.meta.url), {
  throwIfNoEntry: false,
})
const pvpPacked = Boolean(keyFile?.size)
if (!pvpPacked) console.log(`No data pack, so ${PVP_DATA_TESTS.join(', ')} are skipped`)

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    globals: false, // Use explicit imports for describe/it/expect
    // Code under test logs its own rejection paths; that output only matters
    // when a test fails.
    silent: 'passed-only',
    // The tests over real data and screenshots take seconds, and several times
    // that on a busy machine, so the default of 5 s fails them for load alone.
    testTimeout: 30_000,
    exclude: pvpPacked ? configDefaults.exclude : [...configDefaults.exclude, ...PVP_DATA_TESTS],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
