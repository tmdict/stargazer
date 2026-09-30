<script setup lang="ts">
/* One tile state drawn as a hex inside the caller's SVG, for tile-type
   pickers and legends: the board fill, plus the wall hatch and border. */

import { computed, useId } from 'vue'

import TileHatchPatterns from './TileHatchPatterns.vue'
import type { State } from '@/lib/types/state'
import { getTileFillColor, getTileHatchFill, getWallStrokeColor } from '@/utils/tileStateFormatting'

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

const hatch = computed(() => getTileHatchFill(id, state))
</script>

<template>
  <TileHatchPatterns v-if="hatch" :id :hex-size light />
  <polygon :points :fill="getTileFillColor(state)" stroke="#888" stroke-width="2" />
  <polygon
    v-if="hatch"
    :points
    :fill="hatch"
    :stroke="getWallStrokeColor(state)"
    stroke-width="2"
  />
</template>
