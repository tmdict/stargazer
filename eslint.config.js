import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVitest from '@vitest/eslint-plugin'
import pluginVue from 'eslint-plugin-vue'
import { globalIgnores } from 'eslint/config'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/node_modules/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['tests/**/*.test.ts'],
  },
  {
    // CLI scripts run in Node and intentionally use console for output.
    files: ['src/wandwars/scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Disallow stray console calls in app code; warn (not error) for debugging convenience.
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/wandwars/scripts/**/*.ts'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Content files are dynamically-loaded modules (via import.meta.glob),
    // not reusable components referenced by name in templates
    files: ['src/content/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // Template casing convention: kebab-case for props and events on components
    files: ['**/*.vue'],
    rules: {
      'vue/attribute-hyphenation': ['error', 'always'],
      'vue/v-on-event-hyphenation': ['error', 'always', { autofix: true }],
    },
  },
  skipFormatting,
)
