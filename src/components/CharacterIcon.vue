<script setup lang="ts">
import { computed, ref } from 'vue'

import CharacterInfoIcons from './CharacterInfoIcons.vue'
import CharacterTooltip from './CharacterTooltip.vue'
import { useDragDrop } from '@/composables/useDragDrop'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { usePressClick } from '@/composables/usePressClick'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'

const props = defineProps<{
  character: CharacterType
  isDraggable?: boolean
  isPlaced?: boolean
  isSelected?: boolean
  showSimpleTooltip?: boolean
  hideInfo?: boolean
  selectedFilter?: string | null
}>()

const emit = defineEmits<{
  characterClick: [character: CharacterType]
}>()

const gameDataStore = useGameDataStore()
const { startDrag, endDrag } = useDragDrop()
const { onMouseDown, onMouseUp } = usePressClick(() => emit('characterClick', props.character))
const { showTooltip, onMouseEnter, onMouseLeave, onTouchStart } = useHoverTooltip()

const characterElement = ref<HTMLElement>()

const energyIcon = computed(() => gameDataStore.getIcon('initial-energy'))

// Show the energy badge when the initial-energy-300 filter is active
const showEnergy = computed(() => props.selectedFilter === 'initial-energy-300')

// Under-icon badge: single summed value to keep the grid layout tight
const totalEnergy = computed(() => props.character.energy.reduce((sum, n) => sum + n, 0))

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
</script>

<template>
  <div class="character-wrapper">
    <div
      ref="characterElement"
      class="character-display"
      :class="{ draggable: isDraggable, placed: isPlaced, selected: isSelected }"
      :style="{
        background: `url(${gameDataStore.getIcon(`bg-${character.level}`)}) center/cover`,
      }"
      :draggable="isDraggable"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @touchstart="onTouchStart"
    >
      <img
        :src="gameDataStore.getCharacterImage(character.name)"
        :alt="character.name"
        class="portrait"
      />
    </div>
    <CharacterInfoIcons v-if="!hideInfo" :character :selected-filter="selectedFilter" />

    <!-- Energy Display -->
    <div v-if="showEnergy" class="character-energy">
      <img :src="energyIcon" alt="Energy" class="energy-icon" />
      <span class="energy-value">{{ totalEnergy }}</span>
    </div>

    <CharacterTooltip
      v-if="showTooltip && characterElement"
      :character
      :target-element="characterElement"
      :variant="showSimpleTooltip ? 'simple' : 'detailed'"
    />
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

/* Placed on the board: desaturate the icon and dim only the fill (the ::after
   overlay) so the white ring survives, since a whole-element filter/opacity
   would dim it too. Distinct from the red selected ring; --placed-* tokens are
   shared with the phantimal/artifact rosters. */
.character-display.placed {
  filter: var(--placed-filter);
}
.character-display.placed::after {
  /* Clipped to the circle by the parent's overflow: hidden; z-index clears the
     z-index:1 portrait. */
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  background: var(--placed-overlay);
  pointer-events: none;
}

.character-display.selected {
  box-shadow: 0 0 0 5px #c05b4d;
}

/* Energy Display */
.character-energy {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  margin-top: 0.25rem;
  padding-right: 0.8rem;
  font-size: 0.875rem;
}

.character-energy .energy-icon {
  width: 16px;
  height: 16px;
}

.character-energy .energy-value {
  font-weight: 600;
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

  .portrait {
    width: 55px;
    height: 55px;
  }
}
</style>
