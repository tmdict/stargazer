<script setup lang="ts">
import { computed } from 'vue'

import ArtifactIcon from './ArtifactIcon.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import type { ArtifactType } from '@/lib/types/artifact'
import { Team } from '@/lib/types/team'
import { artifactSlot, useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  artifacts: readonly ArtifactType[]
}>()

const { fillOrder, targetArtifactTeam, targetArtifactGridId, clearArtifactTarget, artifactStore } =
  useSelectionState()
const grids = useGrids()
const i18n = useI18nStore()

const slotArtifactId = (team: Team): number | null =>
  team === Team.ALLY ? artifactStore.allyArtifactId : artifactStore.enemyArtifactId

// The team whose slot holds this artifact on any board (page-wide per-team
// uniqueness), or null.
const placedTeam = (artifactId: number): Team | null => {
  if (grids.findArtifactPlacement(artifactId, Team.ALLY)) return Team.ALLY
  if (grids.findArtifactPlacement(artifactId, Team.ENEMY)) return Team.ENEMY
  return null
}

const isArtifactPlaced = (artifactId: number): boolean => placedTeam(artifactId) !== null

const handleArtifactClick = (artifact: ArtifactType) => {
  // Tapping an on-grid artifact cell targets that cell's team on its board
  // (mobile); the pick toggles that slot directly.
  const targeted = targetArtifactTeam.value
  const targetCtx =
    targetArtifactGridId.value !== null ? grids.getContext(targetArtifactGridId.value) : undefined
  if (targeted !== null && targetCtx) {
    if (artifactSlot(targetCtx.artifacts, targeted) === artifact.id)
      targetCtx.removeArtifact(targeted)
    // Block a duplicate of an artifact already on this team's slot on another board.
    else if (!grids.isArtifactUsed(artifact.id, targeted))
      targetCtx.setArtifact(targeted, artifact.id)
    clearArtifactTarget()
    return
  }
  // Already placed (on any board): clicking removes it from wherever it sits.
  const placed = placedTeam(artifact.id)
  if (placed !== null) {
    grids.removeArtifactFromAnyBoard(artifact.id, placed)
    return
  }
  const target = fillOrder.find((team) => slotArtifactId(team) === null)
  if (target !== undefined) artifactStore.placeArtifact(artifact.id, target)
}

// Group artifacts into their own section per season (pre-season first).
const seasonGroups = computed(() => {
  const bySeason = new Map<number, ArtifactType[]>()
  for (const artifact of props.artifacts) {
    const list = bySeason.get(artifact.season) ?? []
    list.push(artifact)
    bySeason.set(artifact.season, list)
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, artifacts]) => ({
      season,
      artifacts: [...artifacts].sort((a, b) => a.id - b.id),
    }))
})

// Pre-season (0) renders without a heading; only real seasons are labelled.
const seasonLabel = (season: number): string => `${i18n.t('game.season')} ${season}`
</script>

<template>
  <div class="artifact-selection">
    <section v-for="group in seasonGroups" :key="group.season" class="artifact-group">
      <h3 v-if="group.season !== 0" class="artifact-group-title">
        {{ seasonLabel(group.season) }}
      </h3>
      <div class="artifacts">
        <div v-for="artifact in group.artifacts" :key="artifact.id" class="artifact-profile">
          <ArtifactIcon
            :artifact="artifact"
            :is-placed="isArtifactPlaced(artifact.id)"
            @artifact-click="handleArtifactClick"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.artifact-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.artifact-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.artifact-group-title {
  margin: 0;
  padding: 0 var(--spacing-lg);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-secondary, var(--color-text-primary));
}

.artifacts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xl);
  justify-content: flex-start;
  padding: var(--spacing-lg);
  border-radius: var(--radius-large);
}

.artifact-profile {
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  margin-top: var(--spacing-xs);
  color: var(--color-text-primary);
}

@media (max-width: 768px) {
  .artifacts {
    gap: var(--spacing-lg);
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .artifact-selection {
    gap: var(--spacing-md);
  }

  .artifacts {
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
  }

  .artifact-profile {
    font-size: 0.9rem;
  }
}
</style>
