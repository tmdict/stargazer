<script setup lang="ts">
import { ref, computed } from 'vue'

import type { ArtifactType } from '../lib/types/artifact'
import { useI18nStore } from '../stores/i18n'
import { useTouchDetection } from '../composables/useTouchDetection'
import TooltipPopup from './ui/TooltipPopup.vue'

const i18n = useI18nStore()

const props = defineProps<{
  artifact: ArtifactType
  artifactImage: string
  isPlaced?: boolean
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
  return props.artifact.name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
})

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
      :class="[`season-${artifact.season}`, { placed: isPlaced }]"
      @click="handleClick"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @touchstart="handleTouchStart"
    >
      <img :src="artifactImage" :alt="artifact.name" class="portrait" />
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <TooltipPopup
        v-if="showTooltip && artifactElement"
        :targetElement="artifactElement"
        variant="detailed"
        :offset="10"
      >
        <template #content>
          <div class="tooltip-header">
            <div class="tooltip-name">{{ formattedArtifactName }}</div>
          </div>
          <div class="tooltip-info">
            <div class="tooltip-row">
              <span class="tooltip-label">{{ i18n.t('game.season') }}:</span>
              <span class="tooltip-value">{{ artifact.season }}</span>
            </div>
          </div>
        </template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.artifact {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-round);
  border: 2px solid var(--color-bg-white);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0 5px var(--color-bg-white);
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

.portrait {
  width: 80px;
  height: 80px;
  object-fit: cover;
  z-index: 1;
  transform: translateY(-9px) translateX(1.5px);
}

.artifact:hover {
  transform: scale(1.05);
}

.season-0 {
  background: #fff;
}

.artifact.placed {
  box-shadow: 0 0 0 5px var(--color-danger);
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
  color: #fff;
  margin-bottom: 4px;
}

.tooltip-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.tooltip-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  min-width: fit-content;
}

.tooltip-value {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  text-align: right;
}
</style>
