<script setup lang="ts">
/* A straight connection line between two hexes: center to center (border to border),
   or corner to corner when startCorner/endCorner are given. Mirrors GridArrow's stroke
   styling (white shadow + colored line) but with no curve and no arrowhead. */

import { computed } from 'vue'

import { useGridStore } from '@/stores/grid'

interface Props {
  startHexId: number
  endHexId: number
  color: string
  strokeWidth: number
  characterRadius?: number
  // When both are set, the line runs corner to corner (an exact edge) with no pullback.
  startCorner?: number
  endCorner?: number
}

const { startHexId, endHexId, characterRadius = 30, startCorner, endCorner } = defineProps<Props>()

const gridStore = useGridStore()

const scaledCharacterRadius = computed(() => characterRadius * gridStore.getHexScale())

const pathData = computed(() =>
  startCorner !== undefined && endCorner !== undefined
    ? gridStore.getCornerLinePath(startHexId, startCorner, endHexId, endCorner)
    : gridStore.getLinePath(startHexId, endHexId, scaledCharacterRadius.value),
)
</script>

<template>
  <g class="grid-line">
    <!-- White shadow path for visibility over tiles. -->
    <path
      v-if="pathData"
      :d="pathData"
      stroke="white"
      :stroke-width="strokeWidth + 4"
      fill="none"
      opacity="0.8"
      stroke-linecap="round"
    />
    <path
      v-if="pathData"
      :d="pathData"
      :stroke="color"
      :stroke-width="strokeWidth"
      fill="none"
      opacity="0.8"
      stroke-linecap="round"
    />
  </g>
</template>
