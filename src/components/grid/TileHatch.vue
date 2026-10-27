<script setup lang="ts">
/* A wall's hatch on a board, from a `board` TileHatchPatterns: fine on
   breakable walls in the light look, bold on every wall in the dark look, as
   on the preview board. Both are drawn and the look's CSS shows one, so the
   hatch follows a dark region of a light page as the board's colours do. */

import { computed } from 'vue'

import type { State } from '@/lib/types/state'
import { getTileHatchFill, getWallHatchFill } from '@/utils/tileStateFormatting'

const { patternId, state, points } = defineProps<{
  patternId: string
  state: State
  points: string
}>()

const light = computed(() => getTileHatchFill(patternId, state))
const dark = computed(() => getWallHatchFill(`${patternId}-dark`, state))
</script>

<template>
  <g>
    <polygon v-if="light" class="light" :points :fill="light" />
    <polygon v-if="dark" class="dark" :points :fill="dark" />
  </g>
</template>

<style scoped>
.dark {
  display: none;
}

[data-theme='dark'] .dark {
  display: inline;
}

[data-theme='dark'] .light {
  display: none;
}
</style>
