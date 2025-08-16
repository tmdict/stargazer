<script setup lang="ts">
import TeamToggle from './TeamToggle.vue'
import ClearButton from './ClearButton.vue'
import { useSelectionState } from '../../composables/useSelectionState'

interface Props {
  containerClass?: string
  showCounts?: boolean
  allyCount?: number
  enemyCount?: number
  maxAllyCount?: number
  maxEnemyCount?: number
  showFilters?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showCounts: false,
  allyCount: 0,
  enemyCount: 0,
  maxAllyCount: 5,
  maxEnemyCount: 5,
  showFilters: false,
})

const { selectedTeam, characterStore, artifactStore, handleTeamChange, handleClearAll } =
  useSelectionState()
</script>

<template>
  <div :class="containerClass">
    <div class="controls-row">
      <div class="left-controls">
        <TeamToggle
          :selectedTeam
          :showCounts
          :allyCount
          :enemyCount
          :maxAllyCount
          :maxEnemyCount
          @team-change="handleTeamChange"
        />
        <ClearButton @click="handleClearAll" />
        <slot name="filters" v-if="showFilters" />
      </div>
    </div>

    <slot :selectedTeam :characterStore :artifactStore />
  </div>
</template>

<style scoped>
.controls-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.left-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

@media (max-width: 1024px) {
  .left-controls {
    gap: var(--spacing-md);
  }
}

@media (max-width: 768px) {
  .controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-md);
  }

  .left-controls {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
  }
}
</style>
