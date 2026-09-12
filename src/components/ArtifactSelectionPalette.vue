<script setup lang="ts">
/* The artifact icon grid shared by the on-grid artifact popup and the match
   import's review picker. Board-free; the consumer decides what a pick means. */

import ArtifactIcon from './ArtifactIcon.vue'
import type { ArtifactType } from '@/lib/types/artifact'

defineProps<{
  // The pickable pool, in display order.
  artifacts: readonly ArtifactType[]
}>()

const emit = defineEmits<{
  pick: [artifact: ArtifactType]
}>()
</script>

<template>
  <div class="artifacts-grid">
    <div v-for="artifact in artifacts" :key="artifact.id" class="artifact-item">
      <ArtifactIcon :artifact :show-simple-tooltip="true" @artifact-click="emit('pick', $event)" />
    </div>
  </div>
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
  /* Shrinks first when the popup's cap is reached (SelectionPopup is a column). */
  min-height: 0;
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
