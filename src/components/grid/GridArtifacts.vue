<script setup lang="ts">
import { computed } from 'vue'

import { useGridEvents } from '@/composables/useGridEvents'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { isRemoteArtifact, seasonArtifactImageSources } from '@/utils/artifactImage'

const props = defineProps<{
  allyArtifactId?: number | null
  enemyArtifactId?: number | null
  showPerspective?: boolean
  scaleY?: number
  readonly?: boolean
}>()

const gridEvents = useGridEvents()
const gameDataStore = useGameDataStore()
const gridStore = useGridStore()

// Dynamic artifact dimensions based on grid scale
const artifactDimensions = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    containerSize: 45 * scale,
    imageSize: 95 * scale,
    position: 50 * scale,
    offset: 25 * scale,
    borderWidth: Math.max(2, 2 * scale),
    shadowWidth: Math.max(3, 3 * scale),
  }
})

// Compute scaleY transform for artifacts in perspective mode
const getArtifactStyles = () => {
  const { containerSize, borderWidth } = artifactDimensions.value
  const styles: Record<string, string | number> = {
    width: `${containerSize}px`,
    height: `${containerSize}px`,
    borderWidth: `${borderWidth}px`,
  }

  if (props.showPerspective) {
    styles.transform = `scaleY(${props.scaleY || 1.0})`
    styles.transformOrigin = 'center'
    styles.transition = 'transform 0.3s ease-out'
  }

  return styles
}

// Get position styles for ally artifact
const getAllyStyles = computed(() => {
  const { position, offset } = artifactDimensions.value
  return {
    ...getArtifactStyles(),
    bottom: `${offset}px`,
    left: `${position}px`,
  }
})

// Get position styles for enemy artifact
const getEnemyStyles = computed(() => {
  const { position, offset } = artifactDimensions.value
  return {
    ...getArtifactStyles(),
    top: `${offset}px`,
    right: `${position}px`,
  }
})

// Get image styles
const getImageStyles = computed(() => {
  const { imageSize } = artifactDimensions.value
  const scale = gridStore.getHexScale()
  return {
    width: `${imageSize}px`,
    height: `${imageSize}px`,
    transform: `translateY(${-8 * scale}px) translateX(${1 * scale}px)`,
  }
})

// Seasonal icons are full-bleed square art — fill the circle (the local
// getImageStyles overshoot/offset is tuned for the bundled pre-season icons).
const seasonImageStyles = computed(() => ({ width: '100%', height: '100%' }))

// Resolve artifact IDs to records (name + season drive local vs remote icons).
const allyArtifact = computed(() => {
  if (props.allyArtifactId === null || props.allyArtifactId === undefined) return null
  return gameDataStore.getArtifactById(props.allyArtifactId) ?? null
})

const enemyArtifact = computed(() => {
  if (props.enemyArtifactId === null || props.enemyArtifactId === undefined) return null
  return gameDataStore.getArtifactById(props.enemyArtifactId) ?? null
})

const handleArtifactClick = (team: Team) => {
  gridEvents.emit('artifact:remove', team)
}
</script>

<template>
  <div class="grid-artifacts">
    <!-- Ally Artifact (bottom left) -->
    <div
      v-if="allyArtifact"
      class="grid-artifact"
      :class="{ readonly }"
      :style="getAllyStyles"
      @click="!readonly && handleArtifactClick(Team.ALLY)"
    >
      <picture v-if="isRemoteArtifact(allyArtifact.season)" class="artifact-picture">
        <source :srcset="seasonArtifactImageSources(allyArtifact.name).avif" type="image/avif" />
        <source :srcset="seasonArtifactImageSources(allyArtifact.name).webp" type="image/webp" />
        <img
          :src="seasonArtifactImageSources(allyArtifact.name).png"
          :alt="allyArtifact.name"
          class="artifact-image"
          :style="seasonImageStyles"
          loading="lazy"
        />
      </picture>
      <img
        v-else
        :src="gameDataStore.getArtifactImage(allyArtifact.name)"
        :alt="allyArtifact.name"
        class="artifact-image"
        :style="getImageStyles"
      />
    </div>

    <!-- Enemy Artifact (top right) -->
    <div
      v-if="enemyArtifact"
      class="grid-artifact"
      :class="{ readonly }"
      :style="getEnemyStyles"
      @click="!readonly && handleArtifactClick(Team.ENEMY)"
    >
      <picture v-if="isRemoteArtifact(enemyArtifact.season)" class="artifact-picture">
        <source :srcset="seasonArtifactImageSources(enemyArtifact.name).avif" type="image/avif" />
        <source :srcset="seasonArtifactImageSources(enemyArtifact.name).webp" type="image/webp" />
        <img
          :src="seasonArtifactImageSources(enemyArtifact.name).png"
          :alt="enemyArtifact.name"
          class="artifact-image"
          :style="seasonImageStyles"
          loading="lazy"
        />
      </picture>
      <img
        v-else
        :src="gameDataStore.getArtifactImage(enemyArtifact.name)"
        :alt="enemyArtifact.name"
        class="artifact-image"
        :style="getImageStyles"
      />
    </div>
  </div>
</template>

<style scoped>
.grid-artifacts {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.grid-artifact {
  position: absolute;
  border-radius: var(--radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-style: solid;
  border-color: var(--color-bg-white);
  box-shadow: 0 0 0 2px #fff;
  /* White backing for every season (icons may have transparency). */
  background: #fff;
  cursor: pointer;
  pointer-events: auto;
}

.grid-artifact.readonly {
  cursor: default;
}

.artifact-picture {
  display: contents;
}

.artifact-image {
  object-fit: cover;
  z-index: 1;
}
</style>
