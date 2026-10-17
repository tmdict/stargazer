<script setup lang="ts">
import { computed, type Component } from 'vue'

import CharacterTooltip from '../CharacterTooltip.vue'
import HoldRing from '../ui/HoldRing.vue'
import IconBell from '../ui/IconBell.vue'
import IconFlame from '../ui/IconFlame.vue'
import IconInfo from '../ui/IconInfo.vue'
import TooltipPopup from '../ui/TooltipPopup.vue'
import { useDragDrop } from '@/composables/useDragDrop'
import { useGridContext } from '@/composables/useGridContext'
import { useGridEvents } from '@/composables/useGridEvents'
import { useGridHoverTooltip } from '@/composables/useGridHoverTooltip'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { heroInspectTarget, useInspect, type InspectTarget } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { useSelectionState } from '@/composables/useSelectionState'
import { ATTR_SKILL_MODE } from '@/lib/characters/attributes'
import {
  getCharacter,
  getCharacterTeam,
  isBaseHeroId,
  isCompanionUnitId,
  toBaseHeroId,
} from '@/lib/characters/character'
import { inPhantimalBand, phantimalOwnerId } from '@/lib/characters/phantimal'
import { decomposeUnitId } from '@/lib/characters/synergy'
import { PERSPECTIVE, PORTRAIT_RADIUS, STANDING_POINTER_HEIGHT, standingLift } from '@/lib/layout'
import { SKILL_MODES, type SkillMode, type SkillModeIcon } from '@/lib/skills/skillModes'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { phantimalImageUrl } from '@/utils/artifactImage'
import { isTouchClick } from '@/utils/pointer'

interface Props {
  characters: readonly CharacterType[]
  // Gates the hover card only; placement interactions are unaffected.
  showHover: boolean
  showSkills: boolean
  isMapEditorMode: boolean
  readonly?: boolean
  // Force tap-to-lift vs desktop click-to-remove; omit to derive from grid scale.
  tapMode?: boolean
}

const props = defineProps<Props>()

const ctx = useGridContext()
const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const grids = useGrids()
const gridEvents = useGridEvents()

const { startDrag, endDrag } = useDragDrop()
const { liftedHexId, liftedGridId, setLiftedHex, clearLiftedHex } = useSelectionState()

// Hover tooltip: the same character card as the picker. Dismissed on any
// placement change, since an icon removed/swapped from under a still cursor
// fires no mouseleave.
const {
  hoveredEl,
  hovered: hoveredCharacter,
  show,
  hide: hideTooltip,
} = useGridHoverTooltip<CharacterType>(() => ctx.placements)

// A synergy copy keeps its hero's card; companions and phantimals have none.
const baseCharacterAt = (characterId: number): CharacterType | undefined => {
  const { localId } = decomposeUnitId(characterId)
  return isBaseHeroId(localId) ? props.characters.find((c) => c.id === localId) : undefined
}

// Inspect (long-press, right-click, the lifted unit's Skills button).
// Companions and synergy copies open their owner hero's skills; a phantimal's
// companion opens its phantimal's. Units with no page (placeholders, heroes
// without skill text, retired phantimals) have no inspect gesture at all.
const { inspect } = useInspect()

const inspectTargetOf = (unitId: number): InspectTarget | null => {
  if (inPhantimalBand(unitId)) {
    const phantimal = gameDataStore.getPhantimalById(phantimalOwnerId(unitId))
    return phantimal ? { kind: 'phantimal', phantimal } : null
  }
  const hero = props.characters.find((c) => c.id === toBaseHeroId(unitId))
  return hero ? heroInspectTarget(hero) : null
}

const inspectAt = (hexId: number): void => {
  const unitId = getCharacter(ctx.grid, hexId)
  const target = unitId === undefined ? null : inspectTargetOf(unitId)
  if (!target) return
  hideTooltip()
  void inspect(target)
}

const { pressing: holdingHexId, start: startHold, onContextMenu } = useLongPress(inspectAt)

const handlePointerDown = (event: PointerEvent, hexId: number, characterId: number) => {
  if (!props.isMapEditorMode && inspectTargetOf(characterId)) startHold(event, hexId)
}

// A unit with no page keeps the browser's own menu.
const handleContextMenu = (event: MouseEvent, hexId: number, characterId: number) => {
  if (!props.isMapEditorMode && inspectTargetOf(characterId)) onContextMenu(event, hexId)
}

const hoverHint = computed(() =>
  hoveredCharacter.value && heroInspectTarget(hoveredCharacter.value)
    ? i18n.t('app.hold-for-skills')
    : undefined,
)

// Places a control at a point on a sprite, (dx, dy) screen pixels from its
// center. Perspective lifts the sprite and squashes it about its center
// (getCharacterStyle), so the point moves too, and the control undoes the
// board's vertical squash the way sprites do.
const spriteLayerPoint = (hexId: number, dx: number, dy: number): { x: number; y: number } => {
  const { x, y } = ctx.layout.hexToPixel(ctx.grid.getHexById(hexId))
  const lift = ctx.perspective ? standingLift(characterDimensions.value.offset) : 0
  return { x: x + dx, y: y - lift + dy * counterScaleY.value }
}

const spritePoint = (hexId: number, dx: number, dy: number): Record<string, string> => {
  const { x, y } = spriteLayerPoint(hexId, dx, dy)
  return { left: `${x}px`, top: `${y}px`, '--counter-scale-y': String(counterScaleY.value) }
}

// The lift pill's gap from the sprite, and the room it takes above the sprite
// (the gap plus about its height), in screen pixels.
const LIFT_PILL_GAP = 8
const LIFT_PILL_ROOM = LIFT_PILL_GAP + 24

// Anchored to the lifted unit's visual top edge, or below the unit when it would
// leave the band the board draws in (drawnBounds), where team view's crop would
// cut it off.
const liftPill = computed(() => {
  const hexId = liftedHexId.value
  if (hexId === null || liftedGridId.value !== ctx.id) return null
  const unitId = getCharacter(ctx.grid, hexId)
  if (unitId === undefined || !inspectTargetOf(unitId)) return null
  const half = characterDimensions.value.size / 2
  const below = spriteLayerPoint(hexId, 0, -half - LIFT_PILL_ROOM).y < ctx.drawnBounds.y
  const pointer = ctx.perspective ? STANDING_POINTER_HEIGHT : 0
  return {
    below,
    style: {
      ...spritePoint(hexId, 0, below ? half + pointer : -half),
      '--lift-pill-gap': `${LIFT_PILL_GAP}px`,
    },
  }
})

const getCharacterName = (characterId: number, hexId: number): string => {
  const team = getCharacterTeam(ctx.grid, hexId)
  if (team) {
    const customImageName = ctx.getImageModifierForCharacter(characterId, team)
    if (customImageName) {
      return customImageName
    }
  }

  return gameDataStore.getCharacterNameById(characterId) || 'Unknown'
}

// Phantimal-specific render helpers (B1 seam: phantimals reuse the character
// wrapper's positioning, drag, lift and perspective; only image + colour differ).
const PHANTIMAL_COLOR = '#b0b6bb'

// A companion a phantimal spawned renders through the same branch, under its
// owner skill's companion portrait.
const phantimalUrl = (characterId: number) =>
  phantimalImageUrl(gameDataStore.getPhantimalUnitSlug(characterId) ?? '')

const phantimalName = (characterId: number): string =>
  gameDataStore.getPhantimalUnitSlug(characterId) ?? 'Phantimal'

// A phantimal id with no data is retired seasonal content: the id stays in the
// team (removable/replaceable like any unit) and renders as a placeholder.
const isRetiredPhantimal = (characterId: number): boolean =>
  inPhantimalBand(characterId) && !gameDataStore.getPhantimalById(phantimalOwnerId(characterId))

// Neutral disc behind every placed hero (one color for all, not the picker's
// per-level gold/purple). Phantimals keep their own grey; skill-driven colors
// (companion/skill image borders, tile tints) are separate and unaffected.
const CHARACTER_COLOR = '#c4baa6'

const getCharacterColors = (characterId: number) => {
  const color = inPhantimalBand(characterId) ? PHANTIMAL_COLOR : CHARACTER_COLOR
  return { backgroundColor: color, borderColor: color }
}

// Base character size (at 40px hex radius)
const BASE_CHARACTER_SIZE = 2 * PORTRAIT_RADIUS
const BASE_CHARACTER_OFFSET = PORTRAIT_RADIUS
const BASE_MODE_SIZE = 22

// Undoes the board's perspective squash (GridContainer), so sprites stay round.
const counterScaleY = computed(() => (ctx.perspective ? 1 / PERSPECTIVE.compression : 1))

const characterDimensions = computed(() => {
  const scale = ctx.hexScale
  return {
    size: BASE_CHARACTER_SIZE * scale,
    offset: BASE_CHARACTER_OFFSET * scale,
    borderWidth: Math.max(2, 3 * scale),
  }
})

// The mode button reaches past its drawn badge, so a near miss lands on the
// button rather than on the portrait, where a click removes the hero.
const modeDimensions = computed(() => {
  const size = Math.max(16, Math.round(BASE_MODE_SIZE * ctx.hexScale))
  return {
    size,
    hit: Math.max(28, size + 12),
    glyph: Math.round(size * 0.62),
    border: size >= 20 ? 2 : 1.5,
  }
})

const getSkillBorderStyle = (characterId: number, hexId: number) => {
  const team = getCharacterTeam(ctx.grid, hexId)
  if (!team) return {}

  const borderColor = ctx.getColorModifierForCharacter(characterId, team)
  if (borderColor) {
    return { borderColor }
  }
  return {}
}

const getCharacterStyle = (hexId: number) => {
  const position = ctx.layout.hexToPixel(ctx.grid.getHexById(hexId))
  const { size, offset, borderWidth } = characterDimensions.value

  const baseStyle: Record<string, string> = {
    position: 'absolute',
    left: `${position.x - offset}px`,
    top: `${position.y - offset}px`,
    width: `${size}px`,
    height: `${size}px`,
    '--character-border-width': `${borderWidth}px`,
  }

  if (ctx.perspective) {
    const verticalOffset = -standingLift(offset)
    baseStyle.transform = `translateY(${verticalOffset}px) scaleY(${counterScaleY.value})`
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
  if (inPhantimalBand(characterId)) {
    const slug = gameDataStore.getPhantimalUnitSlug(characterId)
    if (!slug) return
    const dragData = {
      id: characterId,
      sourceHexId: hexId,
      sourceGridId: ctx.id,
    } as unknown as CharacterType
    startDrag(event, dragData, characterId, phantimalImageUrl(slug))
    return
  }

  const character = props.characters.find((c) => c.id === toBaseHeroId(characterId))
  if (!character) return

  // sourceHexId marks a board-origin drag (the drop handler routes on it), and
  // id is the placed unit (companion or synergy id), not the base card's.
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

// Hover runs on readonly boards too: the card is pure information gated by
// the pref alone, and the event-bus emits just report the pointer; listeners
// own their interactivity policy (GridTiles ignores these on readonly).
const handleMouseEnter = (event: MouseEvent, hexId: number, characterId: number) => {
  gridEvents.emit('character:mouseenter', hexId)
  if (props.showHover) show(event, baseCharacterAt(characterId))
}

const handleMouseLeave = (hexId: number) => {
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

const MODE_ICONS: Record<SkillModeIcon, Component> = { bell: IconBell, flame: IconFlame }

interface ModeButton {
  hexId: number
  team: Team
  characterId: number
  icon: Component
  mode: SkillMode
  next: number
}

// Mode buttons show while the Skills toggle is on, like the arrows they colour.
// The lookup takes the exact id: a synergy copy cannot hold a mode, because a
// link's upgrade row cannot name its id.
const modeButtons = computed(() =>
  props.showSkills && !props.isMapEditorMode
    ? visiblePlacements.value.flatMap(([hexId, characterId]): ModeButton[] => {
        const entry = SKILL_MODES[characterId]
        const team = getCharacterTeam(ctx.grid, hexId)
        if (!entry || !team) return []
        const position = ctx.getAttr(team, characterId, ATTR_SKILL_MODE)
        const mode = entry.modes[position]
        if (!mode) return []
        const next = (position + 1) % entry.modes.length
        return [{ hexId, team, characterId, icon: MODE_ICONS[entry.icon], mode, next }]
      })
    : [],
)

// On the portrait's rim at its upper right.
const modeStyle = (hexId: number): Record<string, string> => {
  const rim = (characterDimensions.value.size / 2) * Math.SQRT1_2
  const { size, hit, border } = modeDimensions.value
  return {
    ...spritePoint(hexId, rim, -rim),
    '--mode-size': `${size}px`,
    '--mode-hit': `${hit}px`,
    '--mode-border': `${border}px`,
  }
}

const cycleMode = ({ team, characterId, next }: ModeButton): void =>
  ctx.setAttr(team, characterId, ATTR_SKILL_MODE, next)

const {
  anchor: modeAnchor,
  payload: modeHexId,
  onMouseEnter: onModeEnter,
  onMouseLeave: onModeLeave,
  onTouchStart: onModeTouch,
} = useHoverTooltip<number>()
// Read live, so a click renames the open label.
const hoveredMode = computed(
  () => modeButtons.value.find((button) => button.hexId === modeHexId.value)?.mode,
)

// With no mouse or trackpad the mode button only shows the mode and a tap on it
// reaches the portrait, so the lifted hero's pill carries the control.
const liftedMode = computed(() =>
  liftPill.value
    ? modeButtons.value.find((button) => button.hexId === liftedHexId.value)
    : undefined,
)
</script>

<template>
  <div class="character-layer" :style="{ '--standing-pointer': `${STANDING_POINTER_HEIGHT}px` }">
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
      @pointerdown="handlePointerDown($event, hexId, characterId)"
      @contextmenu="handleContextMenu($event, hexId, characterId)"
      @mouseenter="handleMouseEnter($event, hexId, characterId)"
      @mouseleave="handleMouseLeave(hexId)"
    >
      <div class="character-content" :class="{ companion: isCompanionUnitId(characterId) }">
        <div class="character-background" :style="getCharacterColors(characterId)" />
        <!-- draggable=false keeps the wrapper div as the drag source. Images are
             draggable by default, and a swap can replace this node mid-drag
             (character↔phantimal flips the v-if branch). Dragend fired on a
             detached source never reaches the wrapper or document listeners,
             leaving the drag ghost stuck. -->
        <span
          v-if="isRetiredPhantimal(characterId)"
          class="character-image retired-unit"
          :style="{ fontSize: `${characterDimensions.size * 0.4}px` }"
          :title="i18n.t('app.retired')"
        >
          ?
        </span>
        <img
          v-else-if="inPhantimalBand(characterId)"
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
        <div v-if="ctx.perspective" class="character-pointer" />
        <HoldRing v-if="holdingHexId === hexId" />
      </div>
    </div>

    <button
      v-for="button in modeButtons"
      :key="`mode-${button.hexId}`"
      type="button"
      class="skill-mode"
      :style="modeStyle(button.hexId)"
      :disabled="readonly"
      :aria-label="i18n.t(`app.${button.mode.name}`)"
      @click="cycleMode(button)"
      @mouseenter="onModeEnter($event, button.hexId)"
      @mouseleave="onModeLeave"
      @touchstart.passive="onModeTouch"
      @contextmenu="handleContextMenu($event, button.hexId, button.characterId)"
    >
      <span class="skill-mode-badge" :style="{ backgroundColor: button.mode.color }">
        <component :is="button.icon" :size="modeDimensions.glyph" />
      </span>
    </button>

    <div
      v-if="liftPill && liftedHexId !== null"
      class="lift-actions capture-exclude"
      :class="{ below: liftPill.below }"
      :style="liftPill.style"
    >
      <button
        v-if="liftedMode && !readonly"
        type="button"
        class="lift-mode"
        :aria-label="i18n.t(`app.${liftedMode.mode.name}`)"
        @click="cycleMode(liftedMode)"
      >
        <span class="skill-mode-badge" :style="{ backgroundColor: liftedMode.mode.color }">
          <component :is="liftedMode.icon" :size="11" />
        </span>
      </button>
      <button type="button" class="lift-inspect" @click="inspectAt(liftedHexId)">
        <IconInfo :size="16" />
        {{ i18n.t('app.skills') }}
      </button>
    </div>

    <Teleport to="body">
      <TooltipPopup v-if="hoveredMode && modeAnchor" :target-element="modeAnchor" variant="simple">
        <template #content>{{ i18n.t(`app.${hoveredMode.name}`) }}</template>
      </TooltipPopup>
    </Teleport>

    <CharacterTooltip
      v-if="hoveredEl && hoveredCharacter"
      :character="hoveredCharacter"
      :target-element="hoveredEl"
      variant="detailed"
      :hint="hoverHint"
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

/* A long-press is the inspect gesture: iOS would otherwise answer it with the
   image callout, and every touch browser with text selection. */
.character {
  pointer-events: auto;
  cursor: grab;
  transition: transform var(--transition-perspective);
  -webkit-touch-callout: none;
  user-select: none;
}

.character:active {
  cursor: grabbing;
}

.character.map-editor-disabled {
  pointer-events: none;
  cursor: default;
}

/* Readonly keeps pointer events (the hover card needs them, mirroring the
   artifact icons); drag and click are gated in the template. */
.character.readonly {
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

.skill-mode {
  position: absolute;
  width: var(--mode-hit);
  height: var(--mode-hit);
  transform: translate(-50%, -50%) scaleY(var(--counter-scale-y));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  pointer-events: auto;
  cursor: pointer;
  z-index: var(--z-board-controls);
}

.skill-mode:disabled {
  pointer-events: none;
}

.skill-mode:focus-visible {
  outline: none;
}

.skill-mode-badge {
  width: var(--mode-size);
  height: var(--mode-size);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--mode-border) solid #fff;
  border-radius: 50%;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.12s ease-out,
    box-shadow 0.12s ease-out;
}

.skill-mode:focus-visible .skill-mode-badge {
  transform: scale(1.25);
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

@media (hover: hover) {
  .skill-mode:hover .skill-mode-badge {
    transform: scale(1.25);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
}

@media not all and (any-pointer: fine) {
  .skill-mode {
    pointer-events: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skill-mode-badge {
    transition: none;
  }
}

.lift-actions {
  position: absolute;
  transform: translate(-50%, calc(-100% - var(--lift-pill-gap) * var(--counter-scale-y)))
    scaleY(var(--counter-scale-y));
  transform-origin: bottom;
  display: flex;
  align-items: center;
  border-radius: 999px;
  background: var(--color-primary);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
  z-index: var(--z-board-controls);
}

.lift-inspect,
.lift-mode {
  display: flex;
  align-items: center;
  border: none;
  border-radius: 999px;
  background: none;
  cursor: pointer;
}

.lift-inspect {
  gap: 4px;
  padding: 4px 10px 4px 5px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.lift-mode {
  --mode-size: 18px;
  --mode-border: 1.5px;
  padding: 3px 0 3px 3px;
}

.lift-actions::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -5px;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom: 0;
  border-top-color: var(--color-primary);
}

.lift-actions.below {
  transform: translate(-50%, calc(var(--lift-pill-gap) * var(--counter-scale-y)))
    scaleY(var(--counter-scale-y));
  transform-origin: top;
}

.lift-actions.below::after {
  top: -5px;
  bottom: auto;
  border: 5px solid transparent;
  border-top: 0;
  border-bottom-color: var(--color-primary);
}

.character-background {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: var(--character-border-width, 3px) solid;
  border-color: #fff;
}

.retired-unit {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  user-select: none;
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
  bottom: calc(-1 * var(--standing-pointer));
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: var(--standing-pointer) solid #777;
}
</style>
