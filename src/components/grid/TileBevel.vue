<script setup lang="ts">
/* The dark look's inner line on a board tile other than open ground. */

import { computed } from 'vue'

import type { Point } from '@/lib/layout'
import { getTileBevelPoints } from '@/utils/tileStateFormatting'

const { corners, outlineWidth } = defineProps<{
  corners: Point[]
  outlineWidth: number
}>()

const points = computed(() => getTileBevelPoints(corners))
</script>

<template>
  <polygon
    class="tile-bevel"
    :points
    fill="none"
    :stroke-width="(outlineWidth * 2) / 3"
    stroke-linejoin="round"
  />
</template>

<style scoped>
.tile-bevel {
  display: none;
  stroke: var(--tile-bevel);
}

[data-theme='dark'] .tile-bevel {
  display: inline;
}
</style>
