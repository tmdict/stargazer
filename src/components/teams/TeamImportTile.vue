<script lang="ts">
import type { Point } from '@/lib/layout'

// A tile's outline on an import review's screenshot, and its width, which
// sizes what is drawn on the tile: the game's camera draws near rows wider.
export function tileOutline(corners: readonly Point[]): { points: string; width: number } {
  const xs = corners.map((c) => c.x)
  return {
    points: corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
    width: Math.max(...xs) - Math.min(...xs),
  }
}
</script>

<script setup lang="ts">
/* A deployment tile an import review places units on, tinted in its side's
   colour, its edge a share of the tile's width. */

import { Team } from '@/lib/types/team'

defineProps<{
  points: string
  tileWidth: number
  side: Team
  // The tile the picker is open for.
  active?: boolean
}>()

// The edge's width as a share of the tile's.
const EDGE = 0.0114
</script>

<template>
  <polygon
    class="pick-tile"
    :class="[side === Team.ALLY ? 'ally' : 'enemy', { active }]"
    :points
    :style="{ '--edge': `${tileWidth * EDGE}px` }"
  />
</template>

<style scoped>
.pick-tile {
  stroke-width: var(--edge);
  cursor: pointer;
  outline: none;
}

.pick-tile.ally {
  fill: color-mix(in srgb, var(--color-ally) 22%, transparent);
  stroke: color-mix(in srgb, var(--color-ally) 85%, white);
}

.pick-tile.enemy {
  fill: color-mix(in srgb, var(--color-enemy) 24%, transparent);
  stroke: color-mix(in srgb, var(--color-enemy) 70%, white);
}

.pick-tile:hover,
.pick-tile:focus-visible,
.pick-tile.active {
  stroke: #fff;
  stroke-width: calc(var(--edge) * 1.5);
}
</style>
