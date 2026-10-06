<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CharacterTooltip from './CharacterTooltip.vue'
import HoldRing from './ui/HoldRing.vue'
import { useDragDrop } from '@/composables/useDragDrop'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { heroInspectTarget, useInspect, type InspectTarget } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { usePressClick } from '@/composables/usePressClick'
import { totalEnergy } from '@/lib/mechanics'
import type { CharacterType } from '@/lib/types/character'
import type { TagPick } from '@/lib/types/skill'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { characterDisplayName } from '@/utils/nameFormatting'

const props = defineProps<{
  character: CharacterType
  isDraggable?: boolean
  // Greyed out: placed on the board in the picker, not owned in the Rosters tab.
  dimmed?: boolean
  isSelected?: boolean
  showSimpleTooltip?: boolean
  // No hover detail card, where a click already acts or opens the hero's page
  // (the Rosters tab, the Skills hero list).
  hideTooltip?: boolean
  // Right-click or hold opens the hero's skills, as on the board. Off where it
  // would fight the host: the Skills hero list's icons are links, and the
  // empty-tile popup closes when the pointer leaves it.
  inspectable?: boolean
  // Tag chips the skills open on (a host's tag filter, the Mechanics guide's
  // picks). Unset opens the full page.
  inspectChips?: readonly TagPick[]
  showEnergy?: boolean
}>()

const emit = defineEmits<{
  characterClick: [character: CharacterType]
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const { startDrag, endDrag } = useDragDrop()
const {
  onMouseDown,
  onMouseUp,
  cancel: cancelPress,
} = usePressClick(() => emit('characterClick', props.character))
const { showTooltip, onMouseEnter, onMouseLeave, onTouchStart } = useHoverTooltip()

const characterElement = ref<HTMLElement>()

// A hero can join the hero list before its portrait ships, and a portrait can
// fail to load; the tile shows the name instead.
const portraitUrl = computed(() => gameDataStore.getCharacterImage(props.character.name))
const portraitFailed = ref(false)
watch(portraitUrl, () => (portraitFailed.value = false))
const displayName = computed(() => characterDisplayName(i18n.t, props.character))

const energyIcon = computed(() => gameDataStore.getIcon('initial-energy'))

const inspectTarget = computed(() =>
  props.inspectable ? heroInspectTarget(props.character, props.inspectChips) : null,
)
const { inspect } = useInspect()
const {
  pressing,
  start: startHold,
  onContextMenu,
} = useLongPress<InspectTarget>((target) => {
  showTooltip.value = false
  void inspect(target)
})

const handleContextMenu = (event: MouseEvent) => {
  cancelPress()
  if (inspectTarget.value) onContextMenu(event, inspectTarget.value)
}

const handleDragStart = (event: DragEvent) => {
  if (!props.isDraggable) return
  showTooltip.value = false
  startDrag(event, props.character, props.character.id, portraitUrl.value)
}

const handleDragEnd = (event: DragEvent) => {
  if (!props.isDraggable) return
  endDrag(event)
}
</script>

<template>
  <div class="character-wrapper">
    <!-- The frame holds the hold ring outside the portrait's clipped circle. -->
    <div class="portrait-frame">
      <div
        ref="characterElement"
        class="character-display"
        :class="{
          draggable: isDraggable,
          dimmed,
          selected: isSelected,
          inspectable: inspectTarget,
        }"
        :style="{
          background: `url(${gameDataStore.getIcon(`bg-${character.level}`)}) center/cover`,
        }"
        :draggable="isDraggable"
        @dragstart="handleDragStart"
        @dragend="handleDragEnd"
        @mousedown="onMouseDown"
        @mouseup="onMouseUp"
        @pointerdown="inspectTarget && startHold($event, inspectTarget)"
        @contextmenu="handleContextMenu"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
        @touchstart="onTouchStart"
      >
        <!-- The image drags only where the tile does: elsewhere a native image
             drag would start inside the hold's move tolerance and abandon it. -->
        <img
          v-if="portraitUrl && !portraitFailed"
          :src="portraitUrl"
          loading="lazy"
          decoding="async"
          :alt="character.name"
          class="portrait"
          :draggable="isDraggable"
          @error="portraitFailed = true"
        />
        <span v-else class="portrait-name">{{ displayName }}</span>
      </div>
      <HoldRing v-if="pressing" />
    </div>
    <div v-if="$slots.badge" class="portrait-badge">
      <slot name="badge" />
    </div>

    <div v-if="showEnergy" class="character-energy" :class="{ dimmed }">
      <img :src="energyIcon" alt="Energy" class="energy-icon" />
      <span class="energy-value">{{ totalEnergy(character) }}</span>
    </div>

    <CharacterTooltip
      v-if="showTooltip && characterElement && !hideTooltip"
      :character
      :target-element="characterElement"
      :variant="showSimpleTooltip ? 'simple' : 'detailed'"
      :hint="inspectTarget ? i18n.t('app.hold-for-skills') : undefined"
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

.portrait-frame {
  position: relative;
  width: fit-content;
  margin: 0 auto;
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

.portrait-name {
  position: relative;
  z-index: 1;
  max-width: 100%;
  box-sizing: border-box;
  padding: 6px;
  font-size: 0.8rem;
  line-height: 1.15;
  overflow-wrap: anywhere;
  text-shadow:
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff,
    0 0 3px #fff;
}

/* Every portrait acts on click (or drag), so every one grows on hover. */
.character-display {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.character-display:hover {
  transform: scale(1.05);
}

.draggable {
  cursor: grab;
}

/* A long-press is the inspect gesture: iOS would otherwise answer it with the
   image callout, and every touch browser with text selection. */
.inspectable {
  -webkit-touch-callout: none;
  user-select: none;
}

.draggable:active {
  cursor: grabbing;
}

/* Desaturate the icon and dim only the fill (the ::after overlay) so the white
   ring survives, since a whole-element filter/opacity would dim it too.
   Distinct from the red selected ring; --placed-* tokens are shared with the
   phantimal/artifact pickers. */
.character-display.dimmed {
  filter: var(--placed-filter);
}
.character-display.dimmed::after {
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

/* The portrait's 5px ring sits outside its box, so this small pull seats the
   badge over the ring's visible edge by about a third of its height, as the
   board hero card's pill does. */
.portrait-badge {
  position: relative;
  z-index: 3;
  display: flex;
  justify-content: center;
  margin-top: -2px;
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
