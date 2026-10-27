<script setup lang="ts">
/* The wall hatch patterns for one board SVG. The preview board's bold set
   hatches every wall, in both looks. A `board` instance (live board, Help
   boards, legend swatches) holds both of its looks' sets for TileHatch: a fine
   hatch on breakable walls for the light look, and the bold set, at
   `${id}-dark-…`, for the dark look. Spacing scales with the board's hex radius
   so the hatch reads the same at every board size. Goes inside the SVG's <defs>. */

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

const hatches = computed(() => {
  const bold = [
    { suffix: 'blocked', color: 'rgba(0, 0, 0, 0.4)', ...BOLD },
    { suffix: 'breakable', color: 'rgba(255, 255, 255, 0.18)', ...BOLD },
  ]
  return board
    ? [
        { suffix: 'breakable', color: 'var(--tile-hatch)', ...FINE },
        ...bold.map((hatch) => ({ ...hatch, suffix: `dark-${hatch.suffix}` })),
      ]
    : bold
})
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
