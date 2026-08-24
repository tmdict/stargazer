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
    // Disallow stray console calls in app code; warn (not error) for debugging convenience.
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // window.innerWidth/innerHeight include classic scrollbars and track
    // mobile browser chrome, so overlay code must not read them directly;
    // utils/viewport owns every window-size read and names each intent.
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/utils/viewport.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'innerWidth',
          message: 'Import from @/utils/viewport instead (viewportWidth, clampX, scrollbarGutter).',
        },
        {
          object: 'window',
          property: 'innerHeight',
          message:
            'Import from @/utils/viewport instead (viewportHeight, clampY, dynamicViewportHeight).',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'innerWidth', message: 'Import from @/utils/viewport instead.' },
        { name: 'innerHeight', message: 'Import from @/utils/viewport instead.' },
      ],
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
