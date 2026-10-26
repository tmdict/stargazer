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
