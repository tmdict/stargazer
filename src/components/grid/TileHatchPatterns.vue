<script setup lang="ts">
/* The breakable wall hatch for one board SVG, referenced through
   getTileHatchFill. Spacing scales with the board's hex radius so the hatch
   reads the same at every board size. Goes inside the SVG's <defs>. */

import { computed } from 'vue'

const {
  id,
  hexSize,
  light = false,
  strokeWidth,
} = defineProps<{
  id: string
  hexSize: number
  light?: boolean
  // Legend swatches pass a heavier line: at swatch size the board's ratio
  // draws sub-pixel lines.
  strokeWidth?: number
}>()

const spacing = computed(() => hexSize / (light ? 2 : 3))
const stroke = computed(() => strokeWidth ?? hexSize / (light ? 20 : 9))
const color = computed(() => (light ? '#b2b6af' : 'rgba(255, 255, 255, 0.18)'))
</script>

<template>
  <pattern
    :id="`${id}-breakable`"
    :width="spacing"
    :height="spacing"
    patternUnits="userSpaceOnUse"
    patternTransform="rotate(45)"
  >
    <line x1="0" y1="0" x2="0" :y2="spacing" :stroke="color" :stroke-width="stroke" />
  </pattern>
</template>
