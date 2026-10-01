<script setup lang="ts">
/* The wall hatch patterns for one board SVG, referenced through
   getTileHatchFill. Spacing scales with the board's hex radius so the hatch
   reads the same at every board size. Goes inside the SVG's <defs>. */

import { computed } from 'vue'

const {
  id,
  hexSize,
  light = false,
} = defineProps<{
  id: string
  hexSize: number
  light?: boolean
}>()

const spacing = computed(() => hexSize * (light ? 3 / 8 : 1 / 3))
const stroke = computed(() => hexSize / (light ? 10 : 9))
const hatches = computed(() =>
  light
    ? [
        { suffix: 'blocked', color: '#62696f' },
        { suffix: 'breakable', color: '#a0a39f' },
      ]
    : [
        { suffix: 'blocked', color: 'rgba(0, 0, 0, 0.4)' },
        { suffix: 'breakable', color: 'rgba(255, 255, 255, 0.18)' },
      ],
)
</script>

<template>
  <pattern
    v-for="hatch in hatches"
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
