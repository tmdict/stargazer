<script setup lang="ts">
import { computed } from 'vue'

import ArtifactIcon from './ArtifactIcon.vue'
import SelectionPopup from './ui/SelectionPopup.vue'
import type { ArtifactType } from '@/lib/types/artifact'
import type { Team } from '@/lib/types/team'
import { useArtifactStore } from '@/stores/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'

interface Props {
  // The team whose artifact slot the chosen artifact is placed into.
  team: Team
  position: { x: number; y: number }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const gameDataStore = useGameDataStore()
const artifactStore = useArtifactStore()
const grids = useGrids()

// Pre-season first, then by id: mirrors the Seasonal tab ordering.
const sortedArtifacts = computed(() =>
  [...gameDataStore.artifacts].sort((a, b) => a.season - b.season || a.id - b.id),
)

// Drop artifacts already assigned to this team on any board (page-wide per-team
// uniqueness), like the character popup hides placed heroes.
const availableArtifacts = computed(() =>
  sortedArtifacts.value.filter((a) => !grids.isArtifactUsed(a.id, props.team)),
)

const handleSelect = (artifact: ArtifactType) => {
  // The store enforces per-team uniqueness; close only on a successful placement.
  if (artifactStore.placeArtifact(artifact.id, props.team)) emit('close')
}
</script>

<template>
  <SelectionPopup :position @close="emit('close')">
    <div class="artifacts-grid">
      <div v-for="artifact in availableArtifacts" :key="artifact.id" class="artifact-item">
        <ArtifactIcon :artifact :show-simple-tooltip="true" @artifact-click="handleSelect" />
      </div>
    </div>
  </SelectionPopup>
</template>

<style scoped>
.artifacts-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  /* overflow-y:auto forces overflow-x to auto; pin it hidden so the hover
     scale-up can't add a horizontal scrollbar. Padding gives edge icons room. */
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 300px;
  padding: 2px 4px;
}

.artifact-item {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.artifact-item:hover {
  transform: scale(1.1);
  filter: brightness(1.2);
}

/* Compact: drop the name pill. The hover tooltip still shows the name. */
.artifact-item :deep(.info-pill-wrap) {
  display: none;
}

/* Match the character-popup icon style: smaller, borderless, subtle 1px ring
   (no thick white edge or white wash). */
.artifact-item :deep(.artifact) {
  margin-top: 0;
  width: 45px;
  height: 45px;
  border: none;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.artifact-item :deep(.artifact::before) {
  display: none;
}
</style>
