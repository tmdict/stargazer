<script setup lang="ts">
import GridArrow from './GridArrow.vue'
import GridArrowLayer from './GridArrowLayer.vue'
import { TEAM_ARROW_COLORS, useArrowStyle } from '@/composables/useArrowLayer'
import { useGridContext } from '@/composables/useGridContext'
import { Team } from '@/lib/types/team'

interface Props {
  defaultSvgHeight: number
}

defineProps<Props>()

const ctx = useGridContext()

// Normal targeting arrows bow harder than skill arrows in the flat view, and arc
// lower in perspective, so the two stay distinct where they share a direction
// (skill arrows use the default scale). Ally and enemy arrows bow to the same side
// (enemy arrows invert), so the enemy scale is larger to nest them apart instead
// of overlapping.
const ALLY_CURVE_SCALE = 1.5
const ENEMY_CURVE_SCALE = 2.0

const arrowStyle = useArrowStyle()

const mutual = (allyHexId: number, enemyHexId: number): boolean =>
  ctx.closestAllyMap.get(enemyHexId)?.allyHexId === allyHexId &&
  ctx.closestEnemyMap.get(allyHexId)?.enemyHexId === enemyHexId
</script>

<template>
  <!-- Closest-target arrows are a two-sided relation; team view crops the
       enemy half away, so the layer hides rather than draw stubs truncated at
       the crop edge (from sprites that are not even rendered, on the enemy
       side). -->
  <GridArrowLayer v-if="!ctx.teamView" :default-svg-height>
    <template #default>
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
    </template>
  </GridArrowLayer>
</template>
