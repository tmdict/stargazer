<script setup lang="ts">
import { computed } from 'vue'

import ArtifactIcon from './ArtifactIcon.vue'
import SelectionContainer from './ui/SelectionContainer.vue'
import { useSelectionState } from '../composables/useSelectionState'
import type { ArtifactType } from '../lib/types/artifact'
import { Team } from '../lib/types/team'

const props = defineProps<{
  artifacts: readonly ArtifactType[]
  artifactImages: Readonly<Record<string, string>>
  icons: Readonly<Record<string, string>>
}>()

const { selectedTeam, artifactStore } = useSelectionState()

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
  return artifactStore.allyArtifactId === artifactId || artifactStore.enemyArtifactId === artifactId
}

const sortedArtifacts = computed(() => {
  return [...props.artifacts].sort((a, b) => a.id - b.id)
})
</script>

<template>
  <SelectionContainer containerClass="artifact-selection">
    <!-- Artifacts Grid -->
    <div class="artifacts">
      <div v-for="artifact in sortedArtifacts" :key="artifact.id" class="artifact-profile">
        <ArtifactIcon
          :artifact="artifact"
          :artifactImage="artifactImages[artifact.name]"
          :isPlaced="isArtifactPlaced(artifact.id)"
          @artifact-click="handleArtifactClick"
        />
      </div>
    </div>
  </SelectionContainer>
</template>

<style scoped>
.artifact-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  gap: var(--spacing-lg);
  min-height: 656px;
  max-height: 656px;
  overflow-y: auto;
}

.artifacts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xl);
  justify-content: flex-start;
  padding: var(--spacing-lg);
  border-radius: var(--radius-large);
  max-height: 70vh;
  overflow-y: auto;
}

.artifact-profile {
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  margin-top: var(--spacing-xs);
  color: var(--color-text-primary);
}

.artifact-info {
  display: flex;
  justify-content: center;
  padding-top: 0.4rem;
}

@media (max-width: 768px) {
  .artifacts {
    gap: var(--spacing-lg);
    padding: var(--spacing-md);
    max-height: 60vh;
  }
}

@media (max-width: 480px) {
  .artifact-selection {
    gap: var(--spacing-md);
  }

  .artifacts {
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
    max-height: 50vh;
  }

  .artifact-profile {
    font-size: 0.9rem;
  }
}
</style>
