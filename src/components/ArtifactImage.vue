<script setup lang="ts">
import type { ArtifactType } from '@/lib/types/artifact'
import { useGameDataStore } from '@/stores/gameData'

defineProps<{ artifact: ArtifactType }>()

const gameDataStore = useGameDataStore()
</script>

<template>
  <!-- draggable=false keeps the GridArtifacts wrapper (not this img) the drag source,
       so the artifact drag carries its payload instead of a native image drag. -->
  <img
    class="artifact-img"
    :src="gameDataStore.getArtifactImage(artifact.name)"
    :alt="artifact.name"
    loading="lazy"
    decoding="async"
    draggable="false"
  />
</template>

<style scoped>
/* z-index keeps it above any parent ::before. */
.artifact-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}
</style>
