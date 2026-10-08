<script setup lang="ts">
/* A site language's glyph: knocked out of a disc for the header, or bare for
   a modal's button. */

import { computed } from 'vue'

import type { AppLocale } from '@/lib/types/i18n'

const {
  locale,
  size = 24,
  noCircle = false,
} = defineProps<{
  locale: AppLocale
  size?: number
  noCircle?: boolean
}>()

// Each script fills the box differently, so each glyph carries its own font
// size and baseline, bare and inside the disc.
const GLYPHS: Record<
  AppLocale,
  { text: string; bare: { size: number; y: number }; disc: { size: number; y: number } }
> = {
  en: { text: 'EN', bare: { size: 14, y: 17 }, disc: { size: 11, y: 16.5 } },
  zh: { text: '中', bare: { size: 18, y: 18 }, disc: { size: 13, y: 17 } },
  ko: { text: '한', bare: { size: 17, y: 18 }, disc: { size: 13, y: 17 } },
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
    <text
      v-if="noCircle"
      x="12"
      :y="glyph.bare.y"
      text-anchor="middle"
      :font-size="glyph.bare.size"
      font-weight="900"
      font-family="system-ui, -apple-system, sans-serif"
    >
      {{ glyph.text }}
    </text>
    <template v-else>
      <defs>
        <mask :id="maskId">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <text
            x="12"
            :y="glyph.disc.y"
            text-anchor="middle"
            fill="black"
            :font-size="glyph.disc.size"
            font-weight="900"
            font-family="system-ui, -apple-system, sans-serif"
          >
            {{ glyph.text }}
          </text>
        </mask>
      </defs>
      <circle cx="12" cy="12" r="10" :mask="`url(#${maskId})`" />
    </template>
  </svg>
</template>
