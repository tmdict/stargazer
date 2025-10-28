<script setup lang="ts">
import { computed } from 'vue'

import { useGridStore } from '@/stores/grid'

interface Props {
  startHexId: number
  endHexId: number
  color: string
  strokeWidth: number
  arrowheadSize: number
  characterRadius?: number
  invertCurve?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  characterRadius: 30,
  invertCurve: false,
  id: '',
})

// Arrow clicks are not currently used

const gridStore = useGridStore()

const markerId = computed(() =>
  props.id ? `arrowhead-${props.id}` : `arrowhead-${props.startHexId}-${props.endHexId}`,
)

// Scale-aware character radius for arrow positioning
const scaledCharacterRadius = computed(() => {
  return props.characterRadius * gridStore.getHexScale()
})

const pathData = computed(() => {
  return gridStore.getArrowPath(
    props.startHexId,
    props.endHexId,
    scaledCharacterRadius.value,
    props.invertCurve,
  )
})
</script>

<template>
  <g class="grid-arrow">
    <defs>
      <marker
        :id="markerId"
        :markerWidth="arrowheadSize"
        :markerHeight="arrowheadSize * 0.7"
        :refX="arrowheadSize - 1"
        :refY="arrowheadSize * 0.35"
        orient="auto"
      >
        <polygon
          :points="`0 0, ${arrowheadSize} ${arrowheadSize * 0.35}, 0 ${arrowheadSize * 0.7}`"
          :fill="color"
          opacity="0.8"
        />
      </marker>
    </defs>
    <!-- White shadow path for better visibility -->
    <path
      v-if="pathData"
      :d="pathData"
      stroke="white"
      :stroke-width="strokeWidth + 4"
      fill="none"
      opacity="0.8"
      stroke-linecap="round"
    />
    <!-- Main arrow path -->
    <path
      v-if="pathData"
      :d="pathData"
      :stroke="color"
      :stroke-width="strokeWidth"
      fill="none"
      opacity="0.8"
      :marker-end="`url(#${markerId})`"
    />
  </g>
</template>

<style scoped>
.grid-arrow path {
  cursor: pointer;
}

.grid-arrow path:hover {
  stroke-opacity: 0.8;
}
</style>
