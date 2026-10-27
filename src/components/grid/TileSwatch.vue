<script setup lang="ts">
/* One tile state drawn as a hex inside the caller's SVG, for tile-type
   pickers and legends: the board fill, plus a wall's border and hatch. */

import { computed, useId } from 'vue'

import TileBevel from './TileBevel.vue'
import TileHatch from './TileHatch.vue'
import TileHatchPatterns from './TileHatchPatterns.vue'
import { State } from '@/lib/types/state'
import {
  getStrongTileStrokeColor,
  getTileFillColor,
  getWallStrokeColor,
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
    :style="{ fill: getTileFillColor(state), stroke: getStrongTileStrokeColor(state) }"
    stroke-width="2"
  />
  <template v-if="stroke">
    <TileHatch :pattern-id="id" :state :corners />
    <polygon :points fill="none" :style="{ stroke }" stroke-width="2" />
  </template>
  <TileBevel v-if="state !== State.DEFAULT" :corners :outline-width="2" />
</template>
