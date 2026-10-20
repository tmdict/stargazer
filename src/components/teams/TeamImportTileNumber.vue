<script setup lang="ts">
/* A tile's number on an import review's screenshot, sized to the tile. */

defineProps<{ x: number; y: number; tileWidth: number; hexId: number }>()
</script>

<template>
  <text
    class="tile-number"
    :x
    :y
    :font-size="tileWidth * 0.2"
    :stroke-width="tileWidth * 0.06"
    text-anchor="middle"
    dominant-baseline="central"
  >
    {{ hexId }}
  </text>
</template>

<style scoped>
.tile-number {
  fill: #fff;
  stroke: rgba(0, 0, 0, 0.75);
  paint-order: stroke;
  font-family: sans-serif;
  font-weight: 700;
  pointer-events: none;
}
</style>
