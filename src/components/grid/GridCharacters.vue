<script setup lang="ts">
import { computed, inject } from 'vue'

import type { DragDropAPI } from '@/components/DragDropProvider.vue'
import { useGridEvents } from '@/composables/useGridEvents'
import { useSelectionState } from '@/composables/useSelectionState'
import { getCharacterTeam } from '@/lib/characters/character'
import { isPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from '@/stores/character'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { useSkillStore } from '@/stores/skill'
import { phantimalImageSources } from '@/utils/artifactImage'

interface Props {
  characters: readonly CharacterType[]
  showPerspective: boolean
  scaleY: number
  isMapEditorMode: boolean
  readonly?: boolean
}

const props = defineProps<Props>()

const gridStore = useGridStore()
const characterStore = useCharacterStore()
const skillStore = useSkillStore()
const gameDataStore = useGameDataStore()
const gridEvents = useGridEvents()

// Inject drag/drop API
const dragDropAPI = inject<DragDropAPI>('dragDrop')
if (!dragDropAPI) {
  throw new Error('GridCharacters must be used within a DragDropProvider')
}

const { startDrag, endDrag } = dragDropAPI

const { liftedHexId, setLiftedHex, clearLiftedHex } = useSelectionState()

const getCharacterName = (characterId: number, hexId: number): string => {
  // Check if this character has a custom image modifier
  const team = getCharacterTeam(gridStore._getGrid(), hexId)
  if (team) {
    const customImageName = skillStore.getImageModifierForCharacter(characterId, team)
    if (customImageName) {
      return customImageName
    }
  }

  return gameDataStore.getCharacterNameById(characterId) || 'Unknown'
}

const getCharacterLevel = (characterId: number): 's' | 'a' => {
  // Handle companion IDs
  const actualId =
    characterId >= COMPANION_ID_OFFSET ? characterId % COMPANION_ID_OFFSET : characterId
  const character = props.characters.find((c) => c.id === actualId)
  return (character?.level as 's' | 'a') || 'a'
}

const isCompanion = (characterId: number): boolean =>
  characterId >= COMPANION_ID_OFFSET && !isPhantimalId(characterId)

// Phantimal-specific render helpers (B1 seam: phantimals reuse the character
// wrapper's positioning, drag, lift and perspective; only image + colour differ).
const PHANTIMAL_COLOR = '#b0b6bb'

const phantimalSources = (characterId: number) =>
  phantimalImageSources(gameDataStore.getPhantimalById(characterId)?.name ?? '')

const phantimalName = (characterId: number): string =>
  gameDataStore.getPhantimalById(characterId)?.name ?? 'Phantimal'

const getCharacterColors = (characterId: number) => {
  if (isPhantimalId(characterId)) {
    return { backgroundColor: PHANTIMAL_COLOR, borderColor: PHANTIMAL_COLOR }
  }

  const level = getCharacterLevel(characterId)
  const baseColor = level === 's' ? '#facd7e' : '#a78fc5'

  return {
    backgroundColor: baseColor,
    borderColor: baseColor,
  }
}

// Base character size (at 40px hex radius)
const BASE_CHARACTER_SIZE = 60
const BASE_CHARACTER_OFFSET = 30

const characterDimensions = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    size: BASE_CHARACTER_SIZE * scale,
    offset: BASE_CHARACTER_OFFSET * scale,
    borderWidth: Math.max(2, 3 * scale), // Min 2px border
    fontSize: Math.max(10, 14 * scale), // Min 10px font
    levelBadgeSize: Math.max(16, 20 * scale), // Level indicator size
  }
})

const getSkillBorderStyle = (characterId: number, hexId: number) => {
  const team = getCharacterTeam(gridStore._getGrid(), hexId)
  if (!team) return {}

  // Check if this character has a color modifier (either main character with skill or companion)
  const borderColor = skillStore.getColorModifierForCharacter(characterId, team)
  if (borderColor) {
    return { borderColor }
  }
  return {}
}

const getCharacterStyle = (hexId: number) => {
  // Use getHexPosition to get SVG coordinates, not screen coordinates
  const position = gridStore.getHexPosition(hexId)
  const { size, offset, borderWidth } = characterDimensions.value

  // Base positioning
  const baseStyle: Record<string, string> = {
    position: 'absolute',
    left: `${position.x - offset}px`,
    top: `${position.y - offset}px`,
    width: `${size}px`,
    height: `${size}px`,
    '--character-border-width': `${borderWidth}px`,
  }

  if (props.showPerspective) {
    const verticalOffset = -70 * gridStore.getHexScale()
    baseStyle.transform = `translateY(${verticalOffset}px) scaleY(${props.scaleY})`
    baseStyle.transformOrigin = 'center'
  }

  return baseStyle
}

const handleDragStart = (event: DragEvent, hexId: number, characterId: number) => {
  if (props.isMapEditorMode) return

  // Phantimals carry a minimal payload (the drop handler only needs id +
  // sourceHexId); their image comes from the remote phantimal sources.
  if (isPhantimalId(characterId)) {
    const phantimal = gameDataStore.getPhantimalById(characterId)
    if (!phantimal) return
    const dragData = { id: characterId, sourceHexId: hexId } as unknown as CharacterType
    startDrag(event, dragData, characterId, phantimalImageSources(phantimal.name).png)
    return
  }

  // For companions, we need to use the base character data
  const actualId =
    characterId >= COMPANION_ID_OFFSET ? characterId % COMPANION_ID_OFFSET : characterId
  const character = props.characters.find((c) => c.id === actualId)
  if (!character) return

  // Add sourceHexId to differentiate from character selection drags
  // For companions, we pass the companion ID so the system knows it's a companion
  const characterWithSource = { ...character, id: characterId, sourceHexId: hexId }
  const characterName = getCharacterName(characterId, hexId)

  startDrag(event, characterWithSource, characterId, gameDataStore.getCharacterImage(characterName))
}

const handleDragEnd = (event: DragEvent) => {
  endDrag(event)
}

const handleClick = (hexId: number) => {
  if (props.isMapEditorMode) return

  // Mobile/tablet: tap-lift / tap-drop. Tapping a hero lifts it for moving;
  // tapping it again removes it; tapping a different hero while one is lifted
  // swaps the two. (Desktop moves via drag, so a tap there just removes.)
  if (gridStore.getHexScale() < 1) {
    if (liftedHexId.value === hexId) {
      characterStore.removeCharacterFromHex(hexId)
      clearLiftedHex()
    } else if (liftedHexId.value !== null) {
      characterStore.swapCharacters(liftedHexId.value, hexId)
      clearLiftedHex()
    } else {
      setLiftedHex(hexId)
    }
    return
  }

  characterStore.removeCharacterFromHex(hexId)
}

// Handle mouse hover to trigger tile hover effect
const handleMouseEnter = (hexId: number) => {
  if (!props.readonly) {
    gridEvents.emit('character:mouseenter', hexId)
  }
}

const handleMouseLeave = (hexId: number) => {
  if (!props.readonly) {
    gridEvents.emit('character:mouseleave', hexId)
  }
}

// In team view, only render characters on the ally team.
const visiblePlacements = computed(() => {
  const all = characterStore.characterPlacements
  if (!gridStore.teamView) return all
  const filtered = new Map<number, number>()
  for (const [hexId, characterId] of all) {
    if (getCharacterTeam(gridStore._getGrid(), hexId) === Team.ALLY) {
      filtered.set(hexId, characterId)
    }
  }
  return filtered
})
</script>

<template>
  <div class="character-layer">
    <div
      v-for="[hexId, characterId] in visiblePlacements"
      :key="hexId"
      class="character"
      :class="{ 'map-editor-disabled': isMapEditorMode, readonly: readonly }"
      :style="getCharacterStyle(hexId)"
      :draggable="!isMapEditorMode && !readonly"
      @dragstart="!readonly && handleDragStart($event, hexId, characterId)"
      @dragend="!readonly && handleDragEnd($event)"
      @click="!readonly && handleClick(hexId)"
      @mouseenter="handleMouseEnter(hexId)"
      @mouseleave="handleMouseLeave(hexId)"
    >
      <div class="character-content" :class="{ companion: isCompanion(characterId) }">
        <div class="character-background" :style="getCharacterColors(characterId)" />
        <picture v-if="isPhantimalId(characterId)" class="phantimal-pic">
          <source :srcset="phantimalSources(characterId).avif" type="image/avif" />
          <source :srcset="phantimalSources(characterId).webp" type="image/webp" />
          <img
            :src="phantimalSources(characterId).png"
            :alt="phantimalName(characterId)"
            class="character-image"
          />
        </picture>
        <img
          v-else
          :src="gameDataStore.getCharacterImage(getCharacterName(characterId, hexId))"
          :alt="getCharacterName(characterId, hexId)"
          class="character-image"
          :style="getSkillBorderStyle(characterId, hexId)"
        />
        <div v-if="showPerspective" class="character-pointer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.character {
  pointer-events: auto;
  cursor: grab;
  transition: transform 0.3s ease-out;
}

.character:active {
  cursor: grabbing;
}

.character.map-editor-disabled {
  pointer-events: none;
  cursor: default;
}

.character.readonly {
  pointer-events: none;
  cursor: default;
}

.character-content {
  width: 100%;
  height: 100%;
  position: relative;
}

.character-background {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: var(--character-border-width, 3px) solid;
  border-color: #fff;
}

/* display: contents so the <picture> doesn't add a box around the phantimal image. */
.phantimal-pic {
  display: contents;
}

.character-image {
  position: absolute;
  top: var(--character-border-width, 3px);
  left: var(--character-border-width, 3px);
  width: calc(100% - 2 * var(--character-border-width, 3px));
  height: calc(100% - 2 * var(--character-border-width, 3px));
  border-radius: 50%;
  object-fit: cover;
  border: var(--character-border-width, 3px) solid #fff;
}

.character-pointer {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid #777;
}
</style>
