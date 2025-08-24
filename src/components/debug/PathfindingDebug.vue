<script setup lang="ts">
import { computed } from 'vue'

import { useGridStore } from '../../stores/grid'
import { usePathfindingStore } from '../../stores/pathfinding'
import { Team } from '../../lib/types/team'
import type DebugGrid from './DebugGrid.vue'

interface Props {
  debugGridRef?: InstanceType<typeof DebugGrid> | null
}

const props = defineProps<Props>()

const gridStore = useGridStore()
const pathfindingStore = usePathfindingStore()

// Get debug pathfinding results from the store
const pathfindingResults = computed(() => pathfindingStore.debugPathfindingResults)

// Dynamic stroke properties based on grid scale
const strokeProps = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    strokeWidth: Math.max(2, 3 * scale), // Min 2px
    dashArray: `${8 * scale},${4 * scale}`,
  }
})

// Generate SVG path strings for each pathfinding result
const pathElements = computed(() => {
  return pathfindingResults.value
    .filter((result) => {
      // Filter based on debug grid visibility settings
      if (props.debugGridRef?.shouldShowDebugLines) {
        return props.debugGridRef.shouldShowDebugLines(result.fromHexId)
      }
      return true // Show all if no debug grid ref available
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
  stroke: #4caf50;
}

.enemy-path {
  stroke: #f44336;
}
</style>
