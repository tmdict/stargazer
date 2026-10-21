<script lang="ts">
// A unit's ring as a share of its tile's width, wider while the unit is
// pointed at in a list. The game's camera draws near rows wider.
const RING = 0.025
const POINTED_RING = 0.05

export const ringWidth = (tileWidth: number, pointed = false): number =>
  tileWidth * (pointed ? POINTED_RING : RING)
</script>

<script setup lang="ts">
/* A unit on a tile of an import review's screenshot, its portrait in a ring,
   or as a preview the unit a click on that tile would place. */

import { useId } from 'vue'

defineProps<{
  x: number
  y: number
  radius: number
  tileWidth: number
  href: string
  // The unit pointed at in a list.
  pointed?: boolean
  preview?: boolean
}>()

const clipId = useId()

// The preview's ring and dashes as shares of the tile's width.
const PREVIEW_RING = 0.03
const DASH = 0.06
const GAP = 0.045
</script>

<template>
  <g class="tile-mark" :class="{ preview }">
    <clipPath :id="clipId">
      <circle :cx="x" :cy="y" :r="radius" />
    </clipPath>
    <image
      :href
      :x="x - radius"
      :y="y - radius"
      :width="radius * 2"
      :height="radius * 2"
      :clip-path="`url(#${clipId})`"
    />
    <circle
      class="ring"
      :class="{ pointed }"
      :cx="x"
      :cy="y"
      :r="radius"
      :stroke-width="preview ? tileWidth * PREVIEW_RING : ringWidth(tileWidth, pointed)"
      :stroke-dasharray="preview ? `${tileWidth * DASH} ${tileWidth * GAP}` : undefined"
    />
  </g>
</template>

<style scoped>
.tile-mark {
  pointer-events: none;
}

.tile-mark:not(.preview) image {
  opacity: 0.85;
}

.tile-mark.preview {
  opacity: 0.75;
}

.ring {
  fill: none;
  stroke: #fff;
}

.ring.pointed {
  stroke: var(--import-warn);
}
</style>
