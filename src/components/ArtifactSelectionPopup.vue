<script setup lang="ts">
import { computed } from 'vue'

import ArtifactIcon from './ArtifactIcon.vue'
import SelectionPopup from './ui/SelectionPopup.vue'
import type { ArtifactType } from '@/lib/types/artifact'
import type { Team } from '@/lib/types/team'
import { useArtifactStore } from '@/stores/artifact'
import { useGameDataStore } from '@/stores/gameData'

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

// Pre-season first, then by id — mirrors the Seasonal tab ordering.
const sortedArtifacts = computed(() =>
  [...gameDataStore.artifacts].sort((a, b) => a.season - b.season || a.id - b.id),
)

const handleSelect = (artifact: ArtifactType) => {
  artifactStore.placeArtifact(artifact.id, props.team)
  emit('close')
}
</script>

<template>
  <SelectionPopup :position @close="emit('close')">
    <div class="artifacts-grid">
      <div v-for="artifact in sortedArtifacts" :key="artifact.id" class="artifact-item">
        <ArtifactIcon :artifact :showSimpleTooltip="true" @artifact-click="handleSelect" />
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

/* Compact: drop the name pill — the hover tooltip still shows the name. */
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

/* Local pre-season art overshoots/recentres within the circle; scale it from the
   50px default to the 45px popup size to preserve the framing. */
.artifact-item :deep(.portrait) {
  width: 72px;
  height: 72px;
  transform: translateY(-8.1px) translateX(1.35px);
}
</style>
