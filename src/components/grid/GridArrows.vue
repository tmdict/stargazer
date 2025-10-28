<script setup lang="ts">
import { computed } from 'vue'

import GridArrow from './GridArrow.vue'
import { useGridStore } from '@/stores/grid'
import { usePathfindingStore } from '@/stores/pathfinding'

interface Props {
  showArrows: boolean
  showPerspective: boolean
  defaultSvgHeight: number
}

const props = defineProps<Props>()

const pathfindingStore = usePathfindingStore()
const gridStore = useGridStore()

// Computed SVG dimensions based on hex scale
const svgDimensions = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    width: 600 * scale,
    height: props.defaultSvgHeight * scale,
  }
})

// Dynamic arrow styling
const arrowStyle = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    strokeWidth: Math.max(2, 3 * scale), // Min 2px
    arrowheadSize: Math.max(4, 6 * scale), // Min 4px
  }
})

// Compute arrow layer transform for perspective mode
const arrowTransform = computed(() => {
  const scale = gridStore.getHexScale()
  return props.showPerspective ? `translate(0, ${-75 * scale})` : ''
})
</script>

<template>
  <svg
    v-if="showArrows"
    class="arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
  >
    <g :transform="arrowTransform">
      <!-- Ally to Enemy arrows (teal) -->
      <GridArrow
        v-for="[allyHexId, enemyInfo] in pathfindingStore.closestEnemyMap"
        :key="`arrow-ally-${allyHexId}-${enemyInfo.enemyHexId}`"
        :start-hex-id="allyHexId"
        :end-hex-id="enemyInfo.enemyHexId!"
        :color="'#36958e'"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
      />

      <!-- Enemy to Ally arrows (red) -->
      <GridArrow
        v-for="[enemyHexId, allyInfo] in pathfindingStore.closestAllyMap"
        :key="`arrow-enemy-${enemyHexId}-${allyInfo.allyHexId}`"
        :start-hex-id="enemyHexId"
        :end-hex-id="allyInfo.allyHexId!"
        :color="'#dc3545'"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
        :invert-curve="true"
      />
    </g>
  </svg>
</template>

<style scoped>
.arrow-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.arrow-layer g {
  transition: transform 0.3s ease-out;
}

.arrow-layer :deep(path) {
  pointer-events: auto;
}
</style>
