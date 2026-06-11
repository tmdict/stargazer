<script setup lang="ts">
import { computed, ref } from 'vue'

import ArtifactImage from './ArtifactImage.vue'
import ArtifactModal from './modals/ArtifactModal.vue'
import InfoPill from './ui/InfoPill.vue'
import TooltipPopup from './ui/TooltipPopup.vue'
import { useTouchDetection } from '@/composables/useTouchDetection'
import type { ArtifactType } from '@/lib/types/artifact'
import { useI18nStore } from '@/stores/i18n'
import { formatArtifactStats } from '@/utils/artifactStats'
import { formatDisplayName } from '@/utils/nameFormatting'

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

const showTooltip = ref(false)
const artifactElement = ref<HTMLElement>()

// Track if interaction started as touch
const interactionStartedAsTouch = ref(false)

const formattedArtifactName = computed(() => {
  // i18n.t returns the key unchanged when no translation exists; fall back then.
  const translationKey = `artifact.${props.artifact.name}`
  const translated = i18n.t(translationKey)
  if (translated !== translationKey) {
    return translated
  }
  return formatDisplayName(props.artifact.name)
})

const formattedStats = computed(() => formatArtifactStats(props.artifact.stats, i18n.currentLocale))

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
      <ArtifactImage :artifact />
    </div>

    <!-- Info pill (effects open in a modal) -->
    <InfoPill :label="formattedArtifactName" @click="openInfoModal" />

    <!-- Effects modal -->
    <ArtifactModal :show="showInfoModal" :artifact @close="showInfoModal = false" />

    <!-- Tooltip -->
    <Teleport to="body">
      <TooltipPopup
        v-if="showTooltip && artifactElement"
        :target-element="artifactElement"
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
