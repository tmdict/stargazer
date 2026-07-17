<script setup lang="ts">
import GridArrow from './GridArrow.vue'
import { useArrowLayer } from '@/composables/useArrowLayer'
import { useGridContext } from '@/composables/useGridContext'

interface Props {
  showPerspective: boolean
  defaultSvgHeight: number
}

const props = defineProps<Props>()

const ctx = useGridContext()

// Normal targeting arrows bow harder than skill arrows so the two stay distinct
// where they share a direction (skill arrows use the default scale). Ally and
// enemy arrows bow to the same side (enemy arrows invert), so the enemy scale is
// larger to nest them apart instead of overlapping.
const ALLY_CURVE_SCALE = 1.5
const ENEMY_CURVE_SCALE = 2.0

const allyArrowColor = '#36958e'
const enemyArrowColor = '#dc3545'

const { svgDimensions, arrowStyle, layerTransform } = useArrowLayer(
  () => props.showPerspective,
  () => props.defaultSvgHeight,
)
</script>

<template>
  <svg class="arrow-layer" :width="svgDimensions.width" :height="svgDimensions.height">
    <g :transform="layerTransform">
      <!-- Ally to Enemy arrows (teal) -->
      <GridArrow
        v-for="[allyHexId, enemyInfo] in ctx.closestEnemyMap"
        :key="`arrow-ally-${allyHexId}-${enemyInfo.enemyHexId}`"
        :start-hex-id="allyHexId"
        :end-hex-id="enemyInfo.enemyHexId!"
        :color="allyArrowColor"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
        :curve-scale="ALLY_CURVE_SCALE"
        dashed
      />

      <!-- Enemy to Ally arrows (red) -->
      <GridArrow
        v-for="[enemyHexId, allyInfo] in ctx.closestAllyMap"
        :key="`arrow-enemy-${enemyHexId}-${allyInfo.allyHexId}`"
        :start-hex-id="enemyHexId"
        :end-hex-id="allyInfo.allyHexId!"
        :color="enemyArrowColor"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
        :invert-curve="true"
        :curve-scale="ENEMY_CURVE_SCALE"
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
