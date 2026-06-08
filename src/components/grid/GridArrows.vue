<script setup lang="ts">
import GridArrow from './GridArrow.vue'
import { useArrowLayer } from '@/composables/useArrowLayer'
import { usePathfindingStore } from '@/stores/pathfinding'

interface Props {
  showArrows: boolean
  showPerspective: boolean
  defaultSvgHeight: number
}

const props = defineProps<Props>()

const pathfindingStore = usePathfindingStore()

// Normal targeting arrows bow harder than skill arrows so the two stay distinct
// where they share a direction (skill arrows use the default scale).
const TARGETING_CURVE_SCALE = 1.5

const { svgDimensions, arrowStyle, layerTransform } = useArrowLayer(
  () => props.showPerspective,
  () => props.defaultSvgHeight,
)
</script>

<template>
  <svg
    v-if="showArrows"
    class="arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
  >
    <g :transform="layerTransform">
      <!-- Ally to Enemy arrows (teal) -->
      <GridArrow
        v-for="[allyHexId, enemyInfo] in pathfindingStore.closestEnemyMap"
        :key="`arrow-ally-${allyHexId}-${enemyInfo.enemyHexId}`"
        :start-hex-id="allyHexId"
        :end-hex-id="enemyInfo.enemyHexId!"
        :color="'#36958e'"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
        :curve-scale="TARGETING_CURVE_SCALE"
        dashed
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
        :curve-scale="TARGETING_CURVE_SCALE"
        dashed
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
</style>
