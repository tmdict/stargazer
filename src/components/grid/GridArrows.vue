<script setup lang="ts">
import GridArrow from './GridArrow.vue'
import { TEAM_ARROW_COLORS, useArrowLayer } from '@/composables/useArrowLayer'
import { useGridContext } from '@/composables/useGridContext'
import { Team } from '@/lib/types/team'

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

const { svgDimensions, arrowStyle, layerTransform } = useArrowLayer(
  () => props.showPerspective,
  () => props.defaultSvgHeight,
)
</script>

<template>
  <svg class="arrow-layer" :width="svgDimensions.width" :height="svgDimensions.height">
    <g :transform="layerTransform">
      <GridArrow
        v-for="[allyHexId, enemyInfo] in ctx.closestEnemyMap"
        :id="`ally-${allyHexId}-${enemyInfo.enemyHexId}`"
        :key="`ally-${allyHexId}-${enemyInfo.enemyHexId}`"
        :start-hex="ctx.grid.getHexById(allyHexId)"
        :end-hex="ctx.grid.getHexById(enemyInfo.enemyHexId!)"
        :color="TEAM_ARROW_COLORS[Team.ALLY]"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
        :curve-scale="ALLY_CURVE_SCALE"
        dashed
      />

      <GridArrow
        v-for="[enemyHexId, allyInfo] in ctx.closestAllyMap"
        :id="`enemy-${enemyHexId}-${allyInfo.allyHexId}`"
        :key="`enemy-${enemyHexId}-${allyInfo.allyHexId}`"
        :start-hex="ctx.grid.getHexById(enemyHexId)"
        :end-hex="ctx.grid.getHexById(allyInfo.allyHexId!)"
        :color="TEAM_ARROW_COLORS[Team.ENEMY]"
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
