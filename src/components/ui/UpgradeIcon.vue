<script setup lang="ts">
/* The paragon crown or the refinement star. Each is drawn at a digit's height:
   on a phone the board panel's pills have no width to spare. The crown's box
   ends at its outer points. It sits a little higher than its box and leaves
   more room before a number than the star does: its weight is in its base and
   its right side is a straight edge, so placed like the star it reads low and
   close. */

import { useI18nStore } from '@/stores/i18n'

defineProps<{
  kind: 'paragon' | 'refinement'
  // A level's number follows, set apart by the room this icon needs.
  beforeLevel?: boolean
}>()

const i18n = useI18nStore()

const SHAPES = {
  paragon: {
    viewBox: '0 0 16.2 16',
    d: 'M0 3.4 L4.5 8.4 L8.1 1 L11.7 8.4 L16.2 3.4 L14.67 15.6 H1.53 Z',
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
    :class="[kind, { 'before-level': beforeLevel }]"
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
  overflow: visible;
  vertical-align: -0.07em;
}

.upgrade-icon.paragon {
  height: 0.74em;
  vertical-align: -0.02em;
  translate: 0 -0.03em;
}

.upgrade-icon.before-level {
  margin-right: 0.06em;
}

.upgrade-icon.paragon.before-level {
  margin-right: 0.14em;
}
</style>
