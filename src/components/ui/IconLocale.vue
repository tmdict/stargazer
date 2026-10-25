<script setup lang="ts">
/* A site language's glyph, knocked out of a disc. */

import { computed } from 'vue'

import type { AppLocale } from '@/lib/types/i18n'

const { locale, size = 24 } = defineProps<{
  locale: AppLocale
  size?: number
}>()

// Each script fills the disc differently, so each glyph carries its own font
// size and baseline.
const GLYPHS: Record<AppLocale, { text: string; size: number; y: number }> = {
  en: { text: 'EN', size: 11, y: 16.5 },
  zh: { text: '中', size: 13, y: 17 },
  ko: { text: '한', size: 13, y: 17 },
}

const glyph = computed(() => GLYPHS[locale])
const maskId = computed(() => `locale-mask-${locale}`)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <mask :id="maskId">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <text
          x="12"
          :y="glyph.y"
          text-anchor="middle"
          fill="black"
          :font-size="glyph.size"
          font-weight="900"
          font-family="system-ui, -apple-system, sans-serif"
        >
          {{ glyph.text }}
        </text>
      </mask>
    </defs>
    <circle cx="12" cy="12" r="10" :mask="`url(#${maskId})`" />
  </svg>
</template>
