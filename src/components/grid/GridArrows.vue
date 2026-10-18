<script setup lang="ts">
import GridArrow from './GridArrow.vue'
import { TEAM_ARROW_COLORS, useArrowLayer } from '@/composables/useArrowLayer'
import { useGridContext } from '@/composables/useGridContext'
import { Team } from '@/lib/types/team'

interface Props {
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

const { svgDimensions, layerStyle, arrowStyle, layerTransform } = useArrowLayer(
  () => props.defaultSvgHeight,
)

const mutual = (allyHexId: number, enemyHexId: number): boolean =>
  ctx.closestAllyMap.get(enemyHexId)?.allyHexId === allyHexId &&
  ctx.closestEnemyMap.get(allyHexId)?.enemyHexId === enemyHexId
</script>

<template>
  <!-- Closest-target arrows are a two-sided relation; team view crops the
       enemy half away, so the layer hides rather than draw stubs truncated at
       the crop edge (from sprites that are not even rendered, on the enemy
       side). -->
  <svg
    v-if="!ctx.teamView"
    class="arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
    :style="layerStyle"
  >
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
        :arc="!mutual(allyHexId, enemyInfo.enemyHexId!)"
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
        :arc="!mutual(allyInfo.allyHexId!, enemyHexId)"
        dashed
      />
    </g>
  </svg>
</template>

<style scoped>
/* Visible overflow: a lifted arrow to the far row rises above the box. */
.arrow-layer {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.arrow-layer g {
  transition: transform var(--transition-perspective);
}
</style>
