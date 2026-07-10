<script setup lang="ts">
import { computed } from 'vue'

import type { ArtifactType } from '@/lib/types/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { isRemoteArtifact, seasonArtifactImageUrl } from '@/utils/artifactImage'

const props = defineProps<{ artifact: ArtifactType }>()

const gameDataStore = useGameDataStore()

// Seasonal icons load remotely (AVIF → WebP → PNG); pre-season icons are bundled locally.
const isRemote = computed(() => isRemoteArtifact(props.artifact.season))
const remoteUrl = computed(() => seasonArtifactImageUrl(props.artifact.name))
</script>

<template>
  <!-- crossorigin keeps the remote icon CORS-clean for the canvas image export.
       draggable=false keeps the GridArtifacts wrapper (not this img) the drag source,
       so the artifact drag carries its payload instead of a native image drag. -->
  <img
    v-if="isRemote"
    class="artifact-img"
    :src="remoteUrl"
    :alt="artifact.name"
    crossorigin="anonymous"
    loading="lazy"
    decoding="async"
    draggable="false"
  />
  <img
    v-else
    class="artifact-img"
    :src="gameDataStore.getArtifactImage(artifact.name)"
    :alt="artifact.name"
    loading="lazy"
    decoding="async"
    draggable="false"
  />
</template>

<style scoped>
/* Square art the parent clips to a circle: fill the parent's box so the inscribed
   circle shows the art at full size. z-index keeps it above any parent ::before. */
.artifact-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}
</style>
