<script setup lang="ts">
import { computed } from 'vue'

import type DebugPanel from './DebugPanel.vue'
import { getTilesWithCharactersByTeam } from '@/lib/characters/character'
import type { GridTile } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import { defaultCanTraverse, findClosestTarget, findPathAStar } from '@/lib/pathfinding'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'

interface Props {
  debugPanelRef?: InstanceType<typeof DebugPanel> | null
}

const props = defineProps<Props>()

const gridStore = useGridStore()

const grids = useGrids()
const gameDataStore = useGameDataStore()

// Each unit's closest target on the other side and a path to it, for both sides
// of the active board.
const pathfindingResults = computed(() => {
  const { grid } = grids.active!
  const getTile = (hex: Hex) => grid.getTileOrUndefined(hex)
  const pathsFrom = (sources: GridTile[], targets: GridTile[], team: Team) =>
    sources.flatMap((source) => {
      const range = gameDataStore.getCharacterRange(source.characterId!) ?? 1
      const closest = findClosestTarget(source, targets, range, getTile, defaultCanTraverse)
      const target = closest && targets.find((tile) => tile.hex.getId() === closest.hexId)
      const path = target && findPathAStar(source.hex, target.hex, getTile, defaultCanTraverse)
      return path ? [{ fromHexId: source.hex.getId(), toHexId: closest.hexId, path, team }] : []
    })
  const allies = getTilesWithCharactersByTeam(grid, Team.ALLY)
  const enemies = getTilesWithCharactersByTeam(grid, Team.ENEMY)
  return [...pathsFrom(allies, enemies, Team.ALLY), ...pathsFrom(enemies, allies, Team.ENEMY)]
})

const strokeProps = computed(() => {
  const scale = grids.getHexScale()
  return {
    strokeWidth: Math.max(2, 3 * scale), // Min 2px
    // Near-zero dashes render as round-cap dots, keeping these lines visually
    // distinct from the targeting arrows' dashes in the shared debug view.
    dashArray: `0.1,${7 * scale}`,
  }
})

const pathElements = computed(() => {
  return pathfindingResults.value
    .filter((result) => {
      // Filter based on debug panel visibility settings
      if (props.debugPanelRef?.shouldShowDebugLines) {
        return props.debugPanelRef.shouldShowDebugLines(result.fromHexId)
      }
      return true // Show all if no debug panel ref available
    })
    .map((result) => {
      const pathPoints = result.path
        .map((hex) => {
          const position = gridStore.layout.hexToPixel(hex)
          return `${position.x},${position.y}`
        })
        .join(' ')

      return {
        id: `path-${result.fromHexId}-${result.toHexId}`,
        points: pathPoints,
        team: result.team,
        fromHexId: result.fromHexId,
        toHexId: result.toHexId,
      }
    })
})
</script>

<template>
  <g class="pathfinding-debug">
    <template v-for="pathElement in pathElements" :key="pathElement.id">
      <polyline
        :points="pathElement.points"
        :class="['debug-path', pathElement.team === Team.ALLY ? 'ally-path' : 'enemy-path']"
        fill="none"
        :stroke-width="strokeProps.strokeWidth"
        :stroke-dasharray="strokeProps.dashArray"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.7"
      />
    </template>
  </g>
</template>

<style scoped>
.debug-path {
  pointer-events: none;
}

.ally-path {
  stroke: var(--unit-frame-ally);
}

.enemy-path {
  stroke: var(--unit-frame-enemy);
}
</style>
