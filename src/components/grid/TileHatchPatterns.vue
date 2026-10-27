<script setup lang="ts">
/* The wall hatch patterns for one board SVG, inside its <defs>. A `board`
   instance holds both looks' sets for TileHatch, the dark one under
   `${id}-dark-…`. Spacing scales with the hex radius so the hatch reads the
   same at every board size. */

import { computed } from 'vue'

const {
  id,
  hexSize,
  board = false,
  strokeWidth,
} = defineProps<{
  id: string
  hexSize: number
  board?: boolean
  // Legend swatches pass a heavier line: at swatch size the board's ratio
  // draws sub-pixel lines.
  strokeWidth?: number
}>()

const FINE = { spacing: 1 / 2, stroke: 1 / 20 }
const BOLD = { spacing: 1 / 3, stroke: 1 / 9 }

const hatches = computed(() =>
  board
    ? [
        { suffix: 'breakable', color: 'var(--tile-hatch-breakable)', ...FINE },
        { suffix: 'dark-blocked', color: 'var(--tile-hatch-blocked)', ...BOLD },
        { suffix: 'dark-breakable', color: 'var(--tile-hatch-breakable)', ...BOLD },
      ]
    : [
        { suffix: 'blocked', color: 'rgba(0, 0, 0, 0.4)', ...BOLD },
        { suffix: 'breakable', color: 'rgba(255, 255, 255, 0.18)', ...BOLD },
      ],
)
</script>

<template>
  <pattern
    v-for="hatch in hatches"
    :id="`${id}-${hatch.suffix}`"
    :key="hatch.suffix"
    :width="hexSize * hatch.spacing"
    :height="hexSize * hatch.spacing"
    patternUnits="userSpaceOnUse"
    patternTransform="rotate(45)"
  >
    <line
      x1="0"
      y1="0"
      x2="0"
      :y2="hexSize * hatch.spacing"
      :style="{ stroke: hatch.color }"
      :stroke-width="strokeWidth ?? hexSize * hatch.stroke"
    />
  </pattern>
</template>
