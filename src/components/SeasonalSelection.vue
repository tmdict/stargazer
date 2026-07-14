<script setup lang="ts">
import ArtifactSelection from './ArtifactSelection.vue'
import PhantimalSelection from './PhantimalSelection.vue'
import type { ArtifactType } from '@/lib/types/artifact'
import type { PhantimalType } from '@/lib/types/phantimal'

const {
  artifacts,
  phantimals,
  isDraggable,
  // See CharacterSelection: off when the roster flows in normal page height (5 v 5).
  scrollable = true,
} = defineProps<{
  artifacts: readonly ArtifactType[]
  phantimals: readonly PhantimalType[]
  isDraggable?: boolean
  scrollable?: boolean
}>()
</script>

<template>
  <div v-scroll-chain class="seasonal-selection" :class="{ scrollable }">
    <PhantimalSelection :phantimals :is-draggable />
    <ArtifactSelection :artifacts />
  </div>
</template>

<style scoped>
.seasonal-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
}

/* See CharacterSelection.vue: wide-screen flex-fill with own scroll, narrow
   stacks naturally and lets the page scroll. */
@media (min-width: 1220px) {
  .seasonal-selection.scrollable {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}

@media (max-width: 480px) {
  .seasonal-selection {
    gap: var(--spacing-md);
  }
}
</style>
