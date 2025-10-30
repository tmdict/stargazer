<script setup lang="ts">
import { computed, ref } from 'vue'

import CharacterInfoIcons from './CharacterInfoIcons.vue'
import TooltipPopup from './ui/TooltipPopup.vue'
import { useDragDrop } from '@/composables/useDragDrop'
import { useTouchDetection } from '@/composables/useTouchDetection'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { formatDisplayName } from '@/utils/nameFormatting'

const props = defineProps<{
  character: CharacterType
  isDraggable?: boolean
  isPlaced?: boolean
  showSimpleTooltip?: boolean
  hideInfo?: boolean
}>()

const emit = defineEmits<{
  characterClick: [character: CharacterType]
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const { startDrag, endDrag } = useDragDrop()
const { isTouchDevice } = useTouchDetection()

// Click detection variables
const isMouseDown = ref(false)
const startTime = ref(0)
const CLICK_THRESHOLD = 200 // ms

// Tooltip state
const showTooltip = ref(false)
const characterElement = ref<HTMLElement>()

// Track if interaction started as touch
const interactionStartedAsTouch = ref(false)

const formattedCharacterName = computed(() => {
  // Use i18n for character name if available, fallback to formatted name
  const translationKey = `character.${props.character.name}`
  const translated = i18n.t(translationKey)
  if (translated !== translationKey) {
    return translated
  }
  // Fallback to formatted name
  return formatDisplayName(props.character.name)
})

const damageIcon = computed(() => {
  return gameDataStore.getIcon(`damage-${props.character.damage}`)
})

const handleDragStart = (event: DragEvent) => {
  if (!props.isDraggable) return
  showTooltip.value = false
  startDrag(
    event,
    props.character,
    props.character.id,
    gameDataStore.getCharacterImage(props.character.name),
  )
}

const handleDragEnd = (event: DragEvent) => {
  if (!props.isDraggable) return
  endDrag(event)
}

const handleMouseDown = () => {
  isMouseDown.value = true
  startTime.value = Date.now()
}

const handleMouseUp = () => {
  if (!isMouseDown.value) return

  const endTime = Date.now()
  const clickDuration = endTime - startTime.value

  // Only emit click if it was a short press (not a drag)
  if (clickDuration < CLICK_THRESHOLD) {
    emit('characterClick', props.character)
  }

  isMouseDown.value = false
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
  <div class="character-wrapper">
    <div
      ref="characterElement"
      class="character-display"
      :class="{ draggable: isDraggable, placed: isPlaced }"
      :style="{
        background: `url(${gameDataStore.getIcon(`bg-${character.level}`)}) center/cover`,
      }"
      :draggable="isDraggable"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @touchstart="handleTouchStart"
    >
      <img
        :src="gameDataStore.getCharacterImage(character.name)"
        :alt="character.name"
        class="portrait"
      />
    </div>
    <CharacterInfoIcons v-if="!hideInfo" :character="character" />

    <!-- Tooltip -->
    <Teleport to="body">
      <TooltipPopup
        v-if="showTooltip && characterElement"
        :targetElement="characterElement"
        :variant="showSimpleTooltip ? 'simple' : 'detailed'"
        :offset="10"
      >
        <template #content>
          <!-- Simple tooltip - just the name -->
          <div v-if="showSimpleTooltip" class="simple-tooltip">
            {{ formattedCharacterName }}
          </div>

          <!-- Detailed tooltip - full info -->
          <template v-else>
            <div class="tooltip-header">
              <h3>{{ formattedCharacterName }}</h3>
            </div>

            <div class="tooltip-content">
              <div class="tooltip-row">
                <img
                  :src="gameDataStore.getIcon(`faction-${character.faction}`)"
                  :alt="character.faction"
                  class="tooltip-icon"
                />
                <span class="tooltip-label">{{ i18n.t('game.faction') }}:</span>
                <span class="tooltip-value">{{ i18n.t(`game.${character.faction}`) }}</span>
              </div>

              <div class="tooltip-row">
                <img
                  :src="gameDataStore.getIcon(`class-${character.class}`)"
                  :alt="character.class"
                  class="tooltip-icon"
                />
                <span class="tooltip-label">{{ i18n.t('game.class') }}:</span>
                <span class="tooltip-value">{{ i18n.t(`game.${character.class}`) }}</span>
              </div>

              <div class="tooltip-row">
                <img
                  v-if="damageIcon"
                  :src="damageIcon"
                  :alt="character.damage"
                  class="tooltip-icon"
                />
                <span class="tooltip-label">{{ i18n.t('game.damage') }}:</span>
                <span class="tooltip-value">{{ i18n.t(`game.${character.damage}`) }}</span>
              </div>

              <div class="tooltip-row">
                <span class="tooltip-label">{{ i18n.t('game.range') }}:</span>
                <span class="tooltip-value">{{ character.range }}</span>
              </div>

              <div class="tooltip-row">
                <span class="tooltip-label">{{ i18n.t('game.energy') }}:</span>
                <span class="tooltip-value">{{ character.energy }}</span>
              </div>

              <div class="tooltip-row">
                <span class="tooltip-label">{{ i18n.t('game.season') }}:</span>
                <span class="tooltip-value">{{ character.season }}</span>
              </div>
            </div>
          </template>
        </template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.character-wrapper {
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  margin-top: 0.25rem;
  color: #333;
}

.character-display {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0 5px #fff;
}

.character-display::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #fff4;
}

.portrait {
  width: 80px;
  height: 80px;
  object-fit: cover;
  z-index: 1;
}

.draggable {
  cursor: grab;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.draggable:hover {
  transform: scale(1.05);
}

.draggable:active {
  cursor: grabbing;
}

.character-display.placed {
  box-shadow: 0 0 0 5px #c05b4d;
}

/* Simple tooltip - just name */
.simple-tooltip {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-align: center;
  white-space: nowrap;
}

/* Tooltip styles */
.tooltip-header {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  text-align: center;
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.tooltip-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.7);
  min-width: 60px;
}

.tooltip-value {
  color: #fff;
  font-weight: 500;
  text-transform: capitalize;
}

/* Special styling for rows without icons */
.tooltip-row:not(:has(.tooltip-icon)) .tooltip-label {
  margin-left: 28px; /* 20px icon + 8px gap */
}

@media (max-width: 768px) {
  .character-wrapper {
    font-size: 0.9rem;
  }

  .character-display {
    width: 60px;
    height: 60px;
  }

  .portrait {
    width: 70px;
    height: 70px;
  }
}

@media (max-width: 480px) {
  .character-wrapper {
    font-size: 0.85rem;
    margin-top: 0.125rem;
  }

  .character-display {
    width: 50px;
    height: 50px;
    box-shadow: 0 0 0 3px #fff;
  }

  .character-display.placed {
    box-shadow: 0 0 0 3px #c05b4d;
  }

  .portrait {
    width: 55px;
    height: 55px;
  }
}
</style>
