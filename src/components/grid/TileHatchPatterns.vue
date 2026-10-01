<script setup lang="ts">
/* The wall hatch patterns for one board SVG: breakable walls, referenced
   through getTileHatchFill, and on the dark preview board solid walls too, to
   match the report's board style. Spacing scales with the board's hex radius so
   the hatch reads the same at every board size. Goes inside the SVG's <defs>. */

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
const hatches = computed(() =>
  light
    ? [{ suffix: 'breakable', color: '#b2b6af' }]
    : [
        { suffix: 'blocked', color: 'rgba(0, 0, 0, 0.4)' },
        { suffix: 'breakable', color: 'rgba(255, 255, 255, 0.18)' },
      ],
)
</script>

<template>
  <pattern
    v-for="hatch in hatches"
    :id="`${id}-${hatch.suffix}`"
    :key="hatch.suffix"
    :width="spacing"
    :height="spacing"
    patternUnits="userSpaceOnUse"
    patternTransform="rotate(45)"
  >
    <line x1="0" y1="0" x2="0" :y2="spacing" :stroke="hatch.color" :stroke-width="stroke" />
  </pattern>
</template>
