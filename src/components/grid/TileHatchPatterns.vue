<script setup lang="ts">
/* The wall hatch patterns for one board SVG, referenced through
   getTileHatchFill. Spacing scales with the board's hex radius so the hatch
   reads the same at every board size. Goes inside the SVG's <defs>. */

const { id, hexSize } = defineProps<{
  id: string
  hexSize: number
}>()

const spacing = hexSize / 3
const stroke = hexSize / 9
</script>

<template>
  <pattern
    v-for="hatch in [
      { suffix: 'blocked', color: 'rgba(0, 0, 0, 0.4)' },
      { suffix: 'breakable', color: 'rgba(0, 0, 0, 0.22)' },
    ]"
    :id="`${id}-${hatch.suffix}`"
    :key="hatch.suffix"
    :width="spacing"
    :height="spacing"
    patternUnits="userSpaceOnUse"
    patternTransform="rotate(45)"
  >
    <line x1="0" y1="0" x2="0" :y2="spacing" :stroke="hatch.color" :stroke-width="stroke" />
  </pattern>
</template>
