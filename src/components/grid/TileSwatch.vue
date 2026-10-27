<script setup lang="ts">
/* One tile state drawn as a hex inside the caller's SVG, for tile-type
   pickers and legends: the board fill, plus a wall's border and hatch. */

import { computed, useId } from 'vue'

import TileHatch from './TileHatch.vue'
import TileHatchPatterns from './TileHatchPatterns.vue'
import type { State } from '@/lib/types/state'
import {
  getTileFillColor,
  getWallStrokeColor,
  TILE_STROKE_COLOR_STRONG,
} from '@/utils/tileStateFormatting'

const { state, points } = defineProps<{
  state: State
  points: string
}>()

const id = useId()

const corners = computed(() =>
  points.split(' ').map((pair) => {
    const [x = 0, y = 0] = pair.split(',').map(Number)
    return { x, y }
  }),
)

const hexSize = computed(() => {
  const ys = corners.value.map((p) => p.y)
  return (Math.max(...ys) - Math.min(...ys)) / 2
})

const stroke = computed(() => getWallStrokeColor(state))
</script>

<template>
  <TileHatchPatterns v-if="stroke" :id :hex-size board :stroke-width="hexSize / 10" />
  <polygon
    :points
    :style="{ fill: getTileFillColor(state), stroke: TILE_STROKE_COLOR_STRONG }"
    stroke-width="2"
  />
  <template v-if="stroke">
    <TileHatch :pattern-id="id" :state :points />
    <polygon :points fill="none" :style="{ stroke }" stroke-width="2" />
  </template>
</template>
