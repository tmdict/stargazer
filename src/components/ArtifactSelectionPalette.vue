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
     scale-up can't add a horizontal scrollbar. */
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 300px;
  min-height: 0;
  padding: 2px var(--palette-inset);
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
  filter: brightness(1.2);
}

.artifact-item :deep(.artifact-frame) {
  margin-top: 0;
}

.artifact-item :deep(.artifact) {
  width: var(--palette-icon-size);
  height: var(--palette-icon-size);
  border: none;
  box-shadow: var(--palette-icon-ring);
}

.artifact-item :deep(.artifact::before) {
  display: none;
}
</style>
