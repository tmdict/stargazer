<script setup lang="ts">
/* Buff tiles' marks on a board's SVG: a stroke at each corner of an outline
   inside the tile's border. The caps and joins are attributes because an
   exported image keeps a shape's own attributes, not its stylesheet's. */

import { computed } from 'vue'

import type { Point } from '@/lib/layout'

const { tiles, hexSize } = defineProps<{
  tiles: { hexId: number; corners: Point[] }[]
  hexSize: number
}>()

// The outline's size against the tile's, the share of an edge a stroke runs
// along, and the stroke's width against the hex radius.
const SCALE = 0.88
const REACH = 0.24
const STROKE = 3 / 40

const toward = (from: Point, to: Point): string =>
  `${from.x + (to.x - from.x) * REACH},${from.y + (to.y - from.y) * REACH}`

const marks = computed(() =>
  tiles.map(({ hexId, corners }) => {
    const cx = corners.reduce((sum, p) => sum + p.x, 0) / corners.length
    const cy = corners.reduce((sum, p) => sum + p.y, 0) / corners.length
    const outline = corners.map((p) => ({
      x: cx + (p.x - cx) * SCALE,
      y: cy + (p.y - cy) * SCALE,
    }))
    return {
      hexId,
      strokes: outline
        .map((p, i, all) => {
          const [before, after] = [all.at(i - 1)!, all[(i + 1) % all.length]!]
          return `M${toward(p, before)} L${p.x},${p.y} L${toward(p, after)}`
        })
        .join(' '),
    }
  }),
)
</script>

<template>
  <g v-if="marks.length" class="buff-marks">
    <path
      v-for="mark in marks"
      :key="mark.hexId"
      class="buff-corners"
      :d="mark.strokes"
      :stroke-width="hexSize * STROKE"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
</template>

<style scoped>
.buff-marks {
  pointer-events: none;
}

.buff-corners {
  fill: none;
  stroke: var(--buff-tile);
}
</style>
