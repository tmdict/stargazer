<script setup lang="ts">
import { computed } from 'vue'

import type { ArtifactType } from '@/lib/types/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { isRemoteArtifact, seasonArtifactImageSources } from '@/utils/artifactImage'

const props = defineProps<{ artifact: ArtifactType }>()

const gameDataStore = useGameDataStore()

// Seasonal icons load remotely (AVIF → WebP → PNG); pre-season icons are bundled locally.
const isRemote = computed(() => isRemoteArtifact(props.artifact.season))
const remoteSources = computed(() => seasonArtifactImageSources(props.artifact.name))
</script>

<template>
  <picture v-if="isRemote" class="artifact-pic">
    <source :srcset="remoteSources.avif" type="image/avif" />
    <source :srcset="remoteSources.webp" type="image/webp" />
    <img :src="remoteSources.png" :alt="artifact.name" class="artifact-img" loading="lazy" />
  </picture>
  <img
    v-else
    class="artifact-img"
    :src="gameDataStore.getArtifactImage(artifact.name)"
    :alt="artifact.name"
  />
</template>

<style scoped>
/* display: contents so the <picture> adds no box — the <img> lays out exactly
   like the bare-<img> branch. */
.artifact-pic {
  display: contents;
}

/* Square art the parent clips to a circle: fill the parent's box so the inscribed
   circle shows the art at full size. z-index keeps it above any parent ::before. */
.artifact-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}
</style>
