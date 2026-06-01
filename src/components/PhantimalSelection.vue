<script setup lang="ts">
import { computed, ref } from 'vue'

import PhantimalModal from './modals/PhantimalModal.vue'
import InfoPill from './ui/InfoPill.vue'
import { useDragDrop } from '@/composables/useDragDrop'
import { useSelectionState } from '@/composables/useSelectionState'
import { toPhantimalId } from '@/lib/characters/phantimal'
import type { CharacterType } from '@/lib/types/character'
import type { PhantimalType } from '@/lib/types/phantimal'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'
import { phantimalImageSources } from '@/utils/artifactImage'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

const { phantimals, isDraggable = false } = defineProps<{
  phantimals: readonly PhantimalType[]
  isDraggable?: boolean
}>()

const i18n = useI18nStore()
const gridStore = useGridStore()
const { selectedTeam, targetHexId, clearTargetHex, characterStore } = useSelectionState()
const { startDrag, endDrag } = useDragDrop()

const sorted = computed(() => [...phantimals].sort((a, b) => a.id - b.id))

// "Season 7 Phantimals" — season number comes from the data.
const heading = computed(() => {
  const season = sorted.value[0]?.season ?? 0
  return `${i18n.t('game.season')} ${season} ${i18n.t('game.phantimal')}`
})

// Hex a phantimal currently occupies on a team, or null. Phantimals are capped at
// one per team, so this also drives the "placed" affordance for the roster.
const placedHexForTeam = (phantimal: PhantimalType, team: typeof selectedTeam.value) => {
  const id = toPhantimalId(phantimal.id)
  const tile = characterStore
    .getTilesWithCharacters()
    .find((t) => t.characterId === id && t.team === team)
  return tile ? tile.hex.getId() : null
}

const isPlaced = (phantimal: PhantimalType): boolean =>
  placedHexForTeam(phantimal, selectedTeam.value) !== null

// Distinguish a tap (place/remove) from a drag using press duration, mirroring
// CharacterIcon so a drag doesn't also fire a placement.
const isMouseDown = ref(false)
const pressStart = ref(0)
const CLICK_THRESHOLD = 200

const handleMouseDown = () => {
  isMouseDown.value = true
  pressStart.value = Date.now()
}

const handleMouseUp = (phantimal: PhantimalType) => {
  if (!isMouseDown.value) return
  isMouseDown.value = false
  if (Date.now() - pressStart.value < CLICK_THRESHOLD) handlePhantimalClick(phantimal)
}

const handlePhantimalClick = (phantimal: PhantimalType) => {
  const id = toPhantimalId(phantimal.id)
  // Mobile: a tapped tile targets a specific cell — place there using its team.
  if (targetHexId.value !== null) {
    const team = getTeamFromTileState(gridStore.getTile(targetHexId.value).state)
    if (team !== null) characterStore.placePhantimalOnHex(targetHexId.value, id, team)
    clearTargetHex()
    return
  }
  const placedHex = placedHexForTeam(phantimal, selectedTeam.value)
  if (placedHex !== null) {
    characterStore.removeCharacterFromHex(placedHex)
    return
  }
  characterStore.autoPlacePhantimal(id, selectedTeam.value)
}

const handleDragStart = (event: DragEvent, phantimal: PhantimalType) => {
  if (!isDraggable) return
  const id = toPhantimalId(phantimal.id)
  // Minimal character-shaped payload: the drop handler only needs the id (no
  // sourceHexId marks it as a roster placement).
  const dragData = { id } as unknown as CharacterType
  startDrag(event, dragData, id, phantimalImageSources(phantimal.name).png)
}

const handleDragEnd = (event: DragEvent) => {
  if (isDraggable) endDrag(event)
}

const selected = ref<PhantimalType | null>(null)
const showModal = ref(false)
const openModal = (phantimal: PhantimalType) => {
  selected.value = phantimal
  showModal.value = true
}
</script>

<template>
  <section v-if="sorted.length" class="phantimal-section">
    <h3 class="phantimal-section-title">{{ heading }}</h3>
    <div class="phantimals">
      <div v-for="phantimal in sorted" :key="phantimal.id" class="phantimal-profile">
        <div
          class="phantimal"
          :class="{ draggable: isDraggable, placed: isPlaced(phantimal) }"
          :draggable="isDraggable"
          @dragstart="handleDragStart($event, phantimal)"
          @dragend="handleDragEnd"
          @mousedown="handleMouseDown"
          @mouseup="handleMouseUp(phantimal)"
        >
          <picture class="portrait-pic">
            <source :srcset="phantimalImageSources(phantimal.name).avif" type="image/avif" />
            <source :srcset="phantimalImageSources(phantimal.name).webp" type="image/webp" />
            <img
              :src="phantimalImageSources(phantimal.name).png"
              :alt="phantimal.name"
              class="portrait"
              loading="lazy"
            />
          </picture>
        </div>
        <InfoPill :label="i18n.t(`game.${phantimal.faction}`)" @click="openModal(phantimal)" />
      </div>
    </div>

    <PhantimalModal
      v-if="selected"
      :show="showModal"
      :phantimal="selected"
      @close="showModal = false"
    />
  </section>
</template>

<style scoped>
.phantimal-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.phantimal-section-title {
  margin: 0;
  padding: 0 var(--spacing-lg);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-secondary, var(--color-text-primary));
}

.phantimals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xl);
  justify-content: flex-start;
  padding: var(--spacing-lg);
}

.phantimal-profile {
  text-align: center;
  margin-top: var(--spacing-xs);
}

.phantimal {
  width: 70px;
  height: 70px;
  border-radius: var(--radius-round);
  border: 2px solid var(--color-bg-white);
  background: #fff;
  overflow: hidden;
  box-shadow: 0 0 0 2px var(--color-bg-white);
  padding: 0;
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.phantimal.draggable {
  cursor: grab;
}

.phantimal.draggable:active {
  cursor: grabbing;
}

.phantimal:hover {
  transform: scale(1.05);
}

/* Placed on the selected team — match the character roster's red ring. */
.phantimal.placed {
  box-shadow: 0 0 0 2px #c05b4d;
  border-color: #c05b4d;
}

/* display: contents so the <picture> doesn't add a box around the image. */
.portrait-pic {
  display: contents;
}

.portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
