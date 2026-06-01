<script setup lang="ts">
import { computed, ref } from 'vue'

import ArtifactModal from './modals/ArtifactModal.vue'
import InfoPill from './ui/InfoPill.vue'
import TooltipPopup from './ui/TooltipPopup.vue'
import { useTouchDetection } from '@/composables/useTouchDetection'
import type { ArtifactType } from '@/lib/types/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { isRemoteArtifact, seasonArtifactImageSources } from '@/utils/artifactImage'
import { formatArtifactStats } from '@/utils/artifactStats'
import { formatDisplayName } from '@/utils/nameFormatting'

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

const props = defineProps<{
  artifact: ArtifactType
  isPlaced?: boolean
  showSimpleTooltip?: boolean
}>()

const emit = defineEmits<{
  artifactClick: [artifact: ArtifactType]
}>()

const { isTouchDevice } = useTouchDetection()

// Tooltip state
const showTooltip = ref(false)
const artifactElement = ref<HTMLElement>()

// Track if interaction started as touch
const interactionStartedAsTouch = ref(false)

const formattedArtifactName = computed(() => {
  // Use i18n for artifact name if available, fallback to formatted name
  const translationKey = `artifact.${props.artifact.name}`
  const translated = i18n.t(translationKey)
  if (translated !== translationKey) {
    return translated
  }
  // Fallback to formatted name
  return formatDisplayName(props.artifact.name)
})

const formattedStats = computed(() => formatArtifactStats(props.artifact.stats, i18n.currentLocale))

// Pre-season icons are bundled locally; seasonal icons load from afkj-data-viewer.
const isRemote = computed(() => isRemoteArtifact(props.artifact.season))
const remoteSources = computed(() => seasonArtifactImageSources(props.artifact.name))

// Effects live in a popup modal (info button), not the hover tooltip.
const showInfoModal = ref(false)
const openInfoModal = () => {
  showInfoModal.value = true
}

const handleClick = () => {
  emit('artifactClick', props.artifact)
}

const handleMouseEnter = () => {
  // Only show tooltip on mouse hover, not after touch events
  if (!isTouchDevice.value && !interactionStartedAsTouch.value) {
    showTooltip.value = true
  }
}

const handleMouseLeave = () => {
  showTooltip.value = false
  interactionStartedAsTouch.value = false // Reset for next interaction
}

const handleTouchStart = () => {
  interactionStartedAsTouch.value = true
  showTooltip.value = false // Ensure tooltip is hidden on touch
}
</script>

<template>
  <div class="artifact-wrapper">
    <div
      ref="artifactElement"
      class="artifact"
      :class="{ placed: isPlaced }"
      @click="handleClick"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @touchstart="handleTouchStart"
    >
      <picture v-if="isRemote" class="portrait-pic">
        <source :srcset="remoteSources.avif" type="image/avif" />
        <source :srcset="remoteSources.webp" type="image/webp" />
        <img :src="remoteSources.png" :alt="artifact.name" class="portrait-season" loading="lazy" />
      </picture>
      <img
        v-else
        :src="gameDataStore.getArtifactImage(artifact.name)"
        :alt="artifact.name"
        class="portrait"
      />
    </div>

    <!-- Info pill (effects open in a modal) -->
    <InfoPill :label="formattedArtifactName" @click="openInfoModal" />

    <!-- Effects modal -->
    <ArtifactModal :show="showInfoModal" :artifact @close="showInfoModal = false" />

    <!-- Tooltip -->
    <Teleport to="body">
      <TooltipPopup
        v-if="showTooltip && artifactElement"
        :targetElement="artifactElement"
        :variant="showSimpleTooltip ? 'simple' : 'detailed'"
        :offset="10"
      >
        <template #content>
          <!-- Simple tooltip - just the name -->
          <div v-if="showSimpleTooltip" class="simple-tooltip">{{ formattedArtifactName }}</div>
          <!-- Detailed tooltip - name + stats -->
          <template v-else>
            <div class="tooltip-header">
              <div class="tooltip-name">{{ formattedArtifactName }}</div>
            </div>
            <div class="tooltip-info">
              <div class="tooltip-row">
                <span class="tooltip-label">{{ i18n.t('game.season') }}:</span>
                <span class="tooltip-value">{{ artifact.season }}</span>
              </div>
              <div v-for="stat in formattedStats" :key="stat.key" class="tooltip-row">
                <span class="tooltip-label">{{ stat.label }}:</span>
                <span class="tooltip-value">{{ stat.value }}</span>
              </div>
            </div>
          </template>
        </template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
/* Center the icon and the (wider, name-bearing) info pill on one column. */
.artifact-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.artifact {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-round);
  border: 2px solid var(--color-bg-white);
  /* White backing for every season (icons may have transparency). */
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0 2px var(--color-bg-white);
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  margin-top: var(--spacing-xs);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.artifact::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-round);
  background: #fff4;
}

/* display: contents so the <picture> wrapper doesn't add a box — the <img>
   participates in the .artifact layout exactly like the bare <img> branch. */
.portrait-pic {
  display: contents;
}

.portrait {
  width: 80px;
  height: 80px;
  object-fit: cover;
  z-index: 1;
  transform: translateY(-9px) translateX(1.5px);
}

/* Seasonal icons are full-bleed square art — fill the circle so the artwork
   reads at full size rather than a small cropped region. */
.portrait-season {
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.artifact:hover {
  transform: scale(1.05);
}

.artifact.placed {
  box-shadow: 0 0 0 2px var(--color-danger);
}

/* Simple tooltip - just name */
.simple-tooltip {
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

/* Tooltip styles */
.tooltip-header {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.tooltip-info {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 16px;
  row-gap: 6px;
  font-size: 13px;
}

.tooltip-row {
  display: contents;
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.7);
}

.tooltip-value {
  font-weight: 500;
}
</style>
