<script setup lang="ts">
/* A straight connection line between two hexes: center to center (border to border),
   or corner to corner when startCorner/endCorner are given. Mirrors GridArrow's stroke
   styling (an edge under a colored line) but with no curve and no arrowhead. */

import { computed } from 'vue'

import { useGridContext } from '@/composables/useGridContext'
import type { Hex } from '@/lib/hex'
import { PORTRAIT_RADIUS } from '@/lib/layout'

interface Props {
  startHex: Hex
  endHex: Hex
  color: string
  strokeWidth: number
  characterRadius?: number
  // When both are set, the line runs corner to corner (an exact edge) with no pullback.
  startCorner?: number
  endCorner?: number
}

const {
  startHex,
  endHex,
  characterRadius = PORTRAIT_RADIUS,
  startCorner,
  endCorner,
} = defineProps<Props>()

const ctx = useGridContext()

const pathData = computed(() =>
  startCorner !== undefined && endCorner !== undefined
    ? ctx.layout.getCornerLinePath(startHex, startCorner, endHex, endCorner)
    : ctx.layout.getLinePath(startHex, endHex, characterRadius * ctx.hexScale),
)

// A corner line is dashed in tile edges, the pattern a quarter edge of dash and a
// quarter of gap, which the round line ends lengthen and shorten by the line's
// width. A line along one edge counts as exactly one, whatever the tilt does to
// its length, and starts and ends on half a dash, so the halves of two edges
// meeting at an outline's corner make one dash. Only the colored core is dashed:
// the edge under it stays whole, so the tile border never shows through a gap.
const EDGE_DASH = 0.25

const dash = computed(() => {
  if (startCorner === undefined || endCorner === undefined) return {}
  let edges = 1
  if (!startHex.equals(endHex)) {
    const from = ctx.layout.polygonCorners(startHex)[startCorner]
    const to = ctx.layout.polygonCorners(endHex)[endCorner]
    if (!from || !to) return {}
    edges = Math.hypot(to.x - from.x, to.y - from.y) / ctx.layout.size.x
  }
  return {
    pathLength: edges,
    'stroke-dasharray': `${EDGE_DASH} ${EDGE_DASH}`,
    'stroke-dashoffset': EDGE_DASH / 2,
  }
})
</script>

<template>
  <g class="grid-line">
    <path
      v-if="pathData"
      class="line-edge"
      :d="pathData"
      :stroke-width="strokeWidth + 4"
      fill="none"
      opacity="0.8"
      stroke-linecap="round"
    />
    <path
      v-if="pathData"
      class="line-core"
      :d="pathData"
      :style="{ stroke: color }"
      :stroke-width="strokeWidth"
      v-bind="dash"
      fill="none"
      stroke-linecap="round"
    />
  </g>
</template>

<style scoped>
.line-edge {
  stroke: var(--skill-edge);
}

.line-core {
  opacity: var(--skill-line-opacity);
}
</style>
