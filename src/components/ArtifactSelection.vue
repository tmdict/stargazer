<script setup lang="ts">
import { computed } from 'vue'

import ArtifactIcon from './ArtifactIcon.vue'
import PhantimalSelection from './PhantimalSelection.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import type { ArtifactType } from '@/lib/types/artifact'
import type { PhantimalType } from '@/lib/types/phantimal'
import { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  artifacts: readonly ArtifactType[]
  phantimals: readonly PhantimalType[]
}>()

const { selectedTeam, artifactStore } = useSelectionState()
const i18n = useI18nStore()

const handleArtifactClick = (artifact: ArtifactType) => {
  // Check if this artifact is already placed for the selected team
  const isAlreadyPlaced =
    (selectedTeam.value === Team.ALLY && artifactStore.allyArtifactId === artifact.id) ||
    (selectedTeam.value === Team.ENEMY && artifactStore.enemyArtifactId === artifact.id)

  if (isAlreadyPlaced) {
    // Remove the artifact if it's already placed
    artifactStore.removeArtifact(selectedTeam.value)
  } else {
    // Place artifact for the selected team
    artifactStore.placeArtifact(artifact.id, selectedTeam.value)
  }
}

const isArtifactPlaced = (artifactId: number): boolean => {
  if (selectedTeam.value === Team.ALLY) {
    return artifactStore.allyArtifactId === artifactId
  } else {
    return artifactStore.enemyArtifactId === artifactId
  }
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
            :isPlaced="isArtifactPlaced(artifact.id)"
            @artifact-click="handleArtifactClick"
          />
        </div>
      </div>
    </section>

    <PhantimalSelection :phantimals />
  </div>
</template>

<style scoped>
.artifact-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
}

/* See CharacterSelection.vue — wide-screen flex-fill with own scroll, narrow
   stacks naturally and lets the page scroll. */
@media (min-width: 1220px) {
  .artifact-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
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
