<script setup lang="ts">
import { computed } from 'vue'

import { useDragDrop } from '@/composables/useDragDrop'
import { useGridContext } from '@/composables/useGridContext'
import { useGridEvents } from '@/composables/useGridEvents'
import { useSelectionState } from '@/composables/useSelectionState'
import { getCharacterTeam } from '@/lib/characters/character'
import { isPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { phantimalImageUrl } from '@/utils/artifactImage'
import { invertTeam } from '@/utils/tileStateFormatting'

interface Props {
  characters: readonly CharacterType[]
  showPerspective: boolean
  scaleY: number
  isMapEditorMode: boolean
  readonly?: boolean
  // Force tap-to-lift vs desktop click-to-remove; omit to derive from grid scale.
  tapMode?: boolean
}

const props = defineProps<Props>()

const ctx = useGridContext()
const gameDataStore = useGameDataStore()
const gridEvents = useGridEvents()

const { startDrag, endDrag } = useDragDrop()

const { liftedHexId, liftedGridId, setLiftedHex, clearLiftedHex } = useSelectionState()

const getCharacterName = (characterId: number, hexId: number): string => {
  // Check if this character has a custom image modifier
  const team = getCharacterTeam(ctx.grid, hexId)
  if (team) {
    const customImageName = ctx.getImageModifierForCharacter(characterId, team)
    if (customImageName) {
      return customImageName
    }
  }

  return gameDataStore.getCharacterNameById(characterId) || 'Unknown'
}

const isCompanion = (characterId: number): boolean =>
  characterId >= COMPANION_ID_OFFSET && !isPhantimalId(characterId)

// Phantimal-specific render helpers (B1 seam: phantimals reuse the character
// wrapper's positioning, drag, lift and perspective; only image + colour differ).
const PHANTIMAL_COLOR = '#b0b6bb'

const phantimalUrl = (characterId: number) =>
  phantimalImageUrl(gameDataStore.getPhantimalById(characterId)?.name ?? '')

const phantimalName = (characterId: number): string =>
  gameDataStore.getPhantimalById(characterId)?.name ?? 'Phantimal'

// Neutral disc behind every placed hero (one color for all, not the roster's
// per-level gold/purple). Phantimals keep their own grey; skill-driven colors
// (companion/skill image borders, tile tints) are separate and unaffected.
const CHARACTER_COLOR = '#c4baa6'

const getCharacterColors = (characterId: number) => {
  const color = isPhantimalId(characterId) ? PHANTIMAL_COLOR : CHARACTER_COLOR
  return { backgroundColor: color, borderColor: color }
}

// Base character size (at 40px hex radius)
const BASE_CHARACTER_SIZE = 60
const BASE_CHARACTER_OFFSET = 30

const characterDimensions = computed(() => {
  const scale = ctx.hexScale
  return {
    size: BASE_CHARACTER_SIZE * scale,
    offset: BASE_CHARACTER_OFFSET * scale,
    borderWidth: Math.max(2, 3 * scale), // Min 2px border
    fontSize: Math.max(10, 14 * scale), // Min 10px font
    levelBadgeSize: Math.max(16, 20 * scale), // Level indicator size
  }
})

const getSkillBorderStyle = (characterId: number, hexId: number) => {
  const team = getCharacterTeam(ctx.grid, hexId)
  if (!team) return {}

  // Check if this character has a color modifier (either main character with skill or companion)
  const borderColor = ctx.getColorModifierForCharacter(characterId, team)
  if (borderColor) {
    return { borderColor }
  }
  return {}
}

const getCharacterStyle = (hexId: number) => {
  // Use getHexPosition to get SVG coordinates, not screen coordinates
  const position = ctx.layout.hexToPixel(ctx.grid.getHexById(hexId))
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
    const verticalOffset = -70 * ctx.hexScale
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
    const dragData = {
      id: characterId,
      sourceHexId: hexId,
      sourceGridId: ctx.id,
    } as unknown as CharacterType
    startDrag(event, dragData, characterId, phantimalImageUrl(phantimal.name))
    return
  }

  // For companions, we need to use the base character data
  const actualId =
    characterId >= COMPANION_ID_OFFSET ? characterId % COMPANION_ID_OFFSET : characterId
  const character = props.characters.find((c) => c.id === actualId)
  if (!character) return

  // Add sourceHexId to differentiate from character selection drags
  // For companions, we pass the companion ID so the system knows it's a companion
  const characterWithSource = {
    ...character,
    id: characterId,
    sourceHexId: hexId,
    sourceGridId: ctx.id,
  }
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
  if (props.tapMode ?? ctx.hexScale < 1) {
    // A lift is scoped to its board; tapping a hero on a different board starts a
    // fresh lift there (cross-board moves use drag).
    if (liftedHexId.value !== null && liftedGridId.value !== ctx.id) {
      setLiftedHex(hexId, ctx.id)
      return
    }
    if (liftedHexId.value === hexId) {
      ctx.remove(hexId)
      clearLiftedHex()
    } else if (liftedHexId.value !== null) {
      ctx.swap(liftedHexId.value, hexId)
      clearLiftedHex()
    } else {
      setLiftedHex(hexId, ctx.id)
    }
    return
  }

  ctx.remove(hexId)
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

// In team view, only render characters on the team shown as ally.
const visiblePlacements = computed(() => {
  const all = ctx.placements
  if (!ctx.teamView) return all
  const shownTeam = invertTeam(Team.ALLY, ctx.inverted)
  const filtered = new Map<number, number>()
  for (const [hexId, characterId] of all) {
    if (getCharacterTeam(ctx.grid, hexId) === shownTeam) {
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
        <!-- draggable=false keeps the wrapper div as the drag source. Images are
             draggable by default, and a swap can replace this node mid-drag
             (character↔phantimal flips the v-if branch) — dragend fired on a
             detached source never reaches the wrapper or document listeners,
             leaving the drag ghost stuck. -->
        <img
          v-if="isPhantimalId(characterId)"
          :src="phantimalUrl(characterId)"
          :alt="phantimalName(characterId)"
          class="character-image"
          draggable="false"
          crossorigin="anonymous"
        />
        <img
          v-else
          :src="gameDataStore.getCharacterImage(getCharacterName(characterId, hexId))"
          :alt="getCharacterName(characterId, hexId)"
          class="character-image"
          :style="getSkillBorderStyle(characterId, hexId)"
          draggable="false"
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
