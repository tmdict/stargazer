<script setup lang="ts">
import { computed } from 'vue'

import CharacterTooltip from '../CharacterTooltip.vue'
import { useDragDrop } from '@/composables/useDragDrop'
import { useGridContext } from '@/composables/useGridContext'
import { useGridEvents } from '@/composables/useGridEvents'
import { useGridHoverTooltip } from '@/composables/useGridHoverTooltip'
import { useSelectionState } from '@/composables/useSelectionState'
import { getCharacter, getCharacterTeam, isBaseHeroId } from '@/lib/characters/character'
import { isPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { phantimalImageUrl } from '@/utils/artifactImage'
import { isTouchClick } from '@/utils/pointer'

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
const grids = useGrids()
const gridEvents = useGridEvents()

const { startDrag, endDrag } = useDragDrop()
const { liftedHexId, liftedGridId, setLiftedHex, clearLiftedHex } = useSelectionState()

// Hover tooltip: the same character card as the roster, for a plainly-hovered base
// hero (companions and phantimals have no roster card, so they're skipped). Dismissed
// on any placement change, since an icon removed/swapped from under a still cursor
// fires no mouseleave.
const {
  hoveredEl,
  hovered: hoveredCharacter,
  show,
  hide: hideTooltip,
} = useGridHoverTooltip<CharacterType>(() => ctx.placements)

const baseCharacterAt = (characterId: number): CharacterType | undefined =>
  isBaseHeroId(characterId) ? props.characters.find((c) => c.id === characterId) : undefined

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
  hideTooltip()
  // Starting a drag abandons any pending lift; a stale lift would otherwise
  // still fire on the next empty-cell tap.
  clearLiftedHex()

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

/* Tap-lift / tap-drop: tapping a hero lifts it for moving; tapping it again
 * removes it; tapping a different hero while one is lifted swaps the two.
 * Sheet layouts use this flow for every pointer; wide layouts split by gesture:
 * touch and pen lift (HTML5 drag is mouse-only), while a mouse click removes,
 * mirroring the game. */
const handleClick = (event: MouseEvent, hexId: number, characterId: number) => {
  if (props.isMapEditorMode) return
  hideTooltip()

  if ((props.tapMode ?? ctx.hexScale < 1) || isTouchClick(event)) {
    // A lift is scoped to its board; tapping a hero on a different board starts a
    // fresh lift there (cross-board hero-to-hero stays a re-lift, not a swap).
    if (liftedHexId.value !== null && liftedGridId.value !== ctx.id) {
      setLiftedHex(hexId, ctx.id, characterId)
      return
    }
    if (liftedHexId.value === hexId) {
      ctx.remove(hexId)
      clearLiftedHex()
    } else if (liftedHexId.value !== null) {
      // Like a drag, a tap-swap that changes teams must keep page-wide character
      // uniqueness; a violation silently no-ops (the lift is consumed either way).
      const liftedId = getCharacter(ctx.grid, liftedHexId.value)
      if (
        liftedId !== undefined &&
        grids.canDropCharacter(liftedId, ctx.id, liftedHexId.value, ctx.id, hexId)
      ) {
        ctx.swap(liftedHexId.value, hexId)
      }
      clearLiftedHex()
    } else {
      setLiftedHex(hexId, ctx.id, characterId)
    }
    return
  }

  ctx.remove(hexId)
}

const handleMouseEnter = (event: MouseEvent, hexId: number, characterId: number) => {
  if (props.readonly) return
  gridEvents.emit('character:mouseenter', hexId)
  show(event, baseCharacterAt(characterId))
}

const handleMouseLeave = (hexId: number) => {
  if (props.readonly) return
  gridEvents.emit('character:mouseleave', hexId)
  hideTooltip()
}

// Sprites are unstacked siblings, so the painter's order must be ascending
// rendered y (near rows over far rows); grid storage order only happens to
// match on the canonical view, and the inverted view reverses it, so sort by
// the rendered position explicitly.
const visiblePlacements = computed(() => {
  const all = [...ctx.placements]
  const filtered = ctx.teamView
    ? all.filter(([hexId]) => getCharacterTeam(ctx.grid, hexId) === Team.ALLY)
    : all
  return filtered.sort(
    ([a], [b]) =>
      ctx.layout.hexToPixel(ctx.grid.getHexById(a)).y -
      ctx.layout.hexToPixel(ctx.grid.getHexById(b)).y,
  )
})
</script>

<template>
  <div class="character-layer">
    <div
      v-for="[hexId, characterId] in visiblePlacements"
      :key="hexId"
      class="character"
      :class="{
        'map-editor-disabled': isMapEditorMode,
        readonly: readonly,
        lifted: liftedHexId === hexId && liftedGridId === ctx.id,
      }"
      :style="getCharacterStyle(hexId)"
      :draggable="!isMapEditorMode && !readonly"
      @dragstart="!readonly && handleDragStart($event, hexId, characterId)"
      @dragend="!readonly && handleDragEnd($event)"
      @click="!readonly && handleClick($event, hexId, characterId)"
      @mouseenter="handleMouseEnter($event, hexId, characterId)"
      @mouseleave="handleMouseLeave(hexId)"
    >
      <div class="character-content" :class="{ companion: isCompanion(characterId) }">
        <div class="character-background" :style="getCharacterColors(characterId)" />
        <!-- draggable=false keeps the wrapper div as the drag source. Images are
             draggable by default, and a swap can replace this node mid-drag
             (character↔phantimal flips the v-if branch). Dragend fired on a
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

    <CharacterTooltip
      v-if="hoveredEl && hoveredCharacter"
      :character="hoveredCharacter"
      :target-element="hoveredEl"
      variant="detailed"
    />
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
  transition: transform 0.15s ease-out;
}

/* Lift styling lives on the inner element because the wrapper's inline
   transform carries the perspective skew. No color or brightness change:
   elevation is conveyed only by the slight scale and a soft diffuse shadow. */
.character.lifted .character-content {
  transform: scale(1.08);
  filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.28));
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
