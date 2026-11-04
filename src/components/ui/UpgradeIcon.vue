<script setup lang="ts">
/* The paragon crown or the refinement star, in the text colour and named for
   screen readers. Each is drawn at a digit's height: on a phone the board
   panel's pills have no width to spare. */

import { useI18nStore } from '@/stores/i18n'

defineProps<{ kind: 'paragon' | 'refinement' }>()

const i18n = useI18nStore()

const SHAPES = {
  paragon: {
    viewBox: '0 0 18 16',
    d: 'M0.9 3.4 L5.4 8.4 L9 1 L12.6 8.4 L17.1 3.4 L15.57 15.6 H2.43 Z',
  },
  refinement: {
    viewBox: '0 0 20 20',
    d: 'M10 0.6 L12.94 6.55 L19.51 7.51 L14.76 12.15 L15.88 18.69 L10 15.6 L4.12 18.69 L5.24 12.15 L0.49 7.51 L7.06 6.55 Z',
  },
} as const
</script>

<template>
  <svg
    class="upgrade-icon"
    :class="kind"
    :viewBox="SHAPES[kind].viewBox"
    fill="currentColor"
    role="img"
    :aria-label="i18n.t(`app.${kind}`)"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path :d="SHAPES[kind].d" />
  </svg>
</template>

<style scoped>
.upgrade-icon {
  flex: none;
  width: auto;
  height: 0.84em;
  vertical-align: -0.07em;
}

.upgrade-icon.paragon {
  height: 0.74em;
  vertical-align: -0.02em;
}
</style>
