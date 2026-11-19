<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CharacterTooltip from '../CharacterTooltip.vue'
import PhantimalTooltip from '../PhantimalTooltip.vue'
import HoldRing from '../ui/HoldRing.vue'
import IconInfo from '../ui/IconInfo.vue'
import TooltipPopup from '../ui/TooltipPopup.vue'
import BuffTileText from './BuffTileText.vue'
import BuffTileTooltip from './BuffTileTooltip.vue'
import GridPointer from './GridPointer.vue'
import UnitBadge from './UnitBadge.vue'
import DuelPiecePicker, { type DuelPiecePick } from '@/components/hd/DuelPiecePicker.vue'
import DuelPieceSlot from '@/components/hd/DuelPieceSlot.vue'
import DuelTierChips from '@/components/hd/DuelTierChips.vue'
import DuelTierPill from '@/components/hd/DuelTierPill.vue'
import DuelTrialToggle from '@/components/hd/DuelTrialToggle.vue'
import { useDragDrop } from '@/composables/useDragDrop'
import { useDuelItems, type DuelItemView } from '@/composables/useDuelItems'
import { useDuelPieceDrag } from '@/composables/useDuelPieceDrag'
import { useGridContext } from '@/composables/useGridContext'
import { useGridHoverTooltip } from '@/composables/useGridHoverTooltip'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { heroInspectTarget, unitInspectTarget, useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { useSelectionState } from '@/composables/useSelectionState'
import { useUnitLabels } from '@/composables/useUnitLabels'
import { ATTR_SKILL_MODE } from '@/lib/characters/attributes'
import {
  getCharacter,
  getCharacterTeam,
  isBaseHeroId,
  isHeroUnit,
  toBaseHeroId,
} from '@/lib/characters/character'
import { inPhantimalBand, isPhantimalId, phantimalOwnerId } from '@/lib/characters/phantimal'
import { isTrialHeroId } from '@/lib/characters/trial'
import { decomposeUnitId } from '@/lib/characters/unitBand'
import { DUEL_ATTR_EQUIPMENT, DUEL_ATTR_TIER, DUEL_TIERS, type DuelTier } from '@/lib/hd/board'
import { hasDuelTierChoice } from '@/lib/hd/units'
import { PORTRAIT_RADIUS, STANDING_POINTER_HEIGHT, type Point } from '@/lib/layout'
import { buffAt } from '@/lib/mapModeLists'
import { SKILL_MODES, type SkillMode } from '@/lib/skills/skillModes'
import type { CharacterType } from '@/lib/types/character'
import type { PhantimalType } from '@/lib/types/phantimal'
import { Team } from '@/lib/types/team'
import type { BadgeIcon } from '@/lib/types/unitBadge'
import { duelOtherCopy, setDuelEquipment, swapDuelCopy } from '@/stores/duelBoard'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { isTouchClick } from '@/utils/pointer'
import { below } from '@/utils/popupLayout'
import { tierBackdrop } from '@/utils/tierBackdrop'

interface Props {
  // Gates the hover card and the mode button's label; placement interactions are unaffected.
  showHover: boolean
  // Placement tips, whose card the board draws for the ally side, so only an
  // enemy unit keeps its hover card.
  showRules: boolean
  // The ally units Placement tips fades while its card shows, by tile.
  faded?: ReadonlySet<number> | null
  showSkin: boolean
  showSkills: boolean
  showBuffTiles?: boolean
  isMapEditorMode: boolean
  readonly?: boolean
  // The sheet layout's tap-to-lift instead of desktop click-to-remove.
  tapMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  unitEnter: [hexId: number]
  unitLeave: [hexId: number]
}>()

const ctx = useGridContext()
const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const { unitName } = useUnitLabels()
const grids = useGrids()

const { startDrag, endDrag } = useDragDrop()
const { liftedHexId, liftedGridId, setLiftedHex, clearLiftedHex } = useSelectionState()

// Hover tooltip: the same hero or phantimal card as the pickers. Dismissed on
// any placement change, since an icon removed/swapped from under a still cursor
// fires no mouseleave.
type HoverCard =
  | { kind: 'hero'; hero: CharacterType; buff?: string; duel?: DuelMark }
  | { kind: 'phantimal'; phantimal: PhantimalType; buff?: string }
  | { kind: 'buff'; buff: string }
const {
  hoveredEl,
  hovered: hoveredCard,
  show,
  hide: hideTooltip,
} = useGridHoverTooltip<HoverCard>(() => ctx.placements)

// A synergy copy keeps its hero's card; companions, a phantimal's included,
// have none.
const cardAt = (characterId: number): HoverCard | undefined => {
  if (isPhantimalId(characterId)) {
    const phantimal = gameDataStore.getPhantimalById(characterId)
    return phantimal && { kind: 'phantimal', phantimal }
  }
  const { localId } = decomposeUnitId(characterId)
  const hero = isBaseHeroId(localId) ? gameDataStore.getCharacterById(localId) : undefined
  return hero && { kind: 'hero', hero }
}

// Inspect (long-press, right-click, the lifted unit's Skills button). Units
// with no page (placeholders, heroes without skill text, retired phantimals)
// have no inspect gesture at all.
const { inspect } = useInspect()

const inspectAt = (hexId: number): void => {
  const unitId = getCharacter(ctx.grid, hexId)
  const target = unitId === undefined ? null : unitInspectTarget(unitId)
  if (!target) return
  hideTooltip()
  void inspect(target)
}

const { pressing: holdingHexId, start: startHold, onContextMenu } = useLongPress(inspectAt)

const handlePointerDown = (event: PointerEvent, hexId: number, characterId: number) => {
  if (!props.isMapEditorMode && unitInspectTarget(characterId)) startHold(event, hexId)
}

// A unit with no page keeps the browser's own menu.
const handleContextMenu = (event: MouseEvent, hexId: number, characterId: number) => {
  if (!props.isMapEditorMode && unitInspectTarget(characterId)) onContextMenu(event, hexId)
}

const hoverHint = computed(() => {
  const card = hoveredCard.value
  const inspectable =
    card?.kind === 'phantimal' || (card?.kind === 'hero' && heroInspectTarget(card.hero))
  // The two rows are never both on, so the one on is the one showing this card.
  const off = props.showHover ? 'app.turn-off-hover-details' : 'app.turn-off-placement-tips'
  return [...(inspectable ? [i18n.t('app.hold-for-skills')] : []), i18n.t(off)]
})

// Where a point dy screen pixels below a sprite's center lands on the layer.
// Perspective lifts the sprite and squashes it about its center
// (getCharacterStyle), so the point moves too.
const spriteLayerY = (hexId: number, dy: number): number => {
  const { y } = ctx.layout.hexToPixel(ctx.grid.getHexById(hexId))
  const lift = ctx.perspective ? ctx.layout.standingLift(characterDimensions.value.offset) : 0
  return y - lift + dy / ctx.layout.squash
}

// The lift pill's gap from the sprite, and the room it takes above the sprite
// (the gap plus about its height), in screen pixels.
const LIFT_PILL_GAP = 8
const LIFT_PILL_ROOM = LIFT_PILL_GAP + 24

// Exposed so Placement tips' card stays clear of it.
const liftActionsEl = ref<HTMLElement | null>(null)
defineExpose({ liftActionsEl })

// Anchored to the lifted unit's visual top edge, or below the unit when it would
// leave the band the board draws in (drawnBounds), where team view's crop would
// cut it off.
const liftPill = computed(() => {
  const hexId = liftedHexId.value
  if (hexId === null || liftedGridId.value !== ctx.id) return null
  const unitId = getCharacter(ctx.grid, hexId)
  if (unitId === undefined) return null
  const inspectable = unitInspectTarget(unitId) !== null
  const duel = props.readonly ? undefined : duelMarkAt(hexId)
  if (!inspectable && !duel) return null
  const half = characterDimensions.value.size / 2
  const pillBelow = spriteLayerY(hexId, -half - LIFT_PILL_ROOM) < ctx.drawnBounds.y
  const pointer = ctx.perspective ? STANDING_POINTER_HEIGHT : 0
  return {
    hexId,
    below: pillBelow,
    inspectable,
    duel,
    style: { '--lift-pill-gap': `${LIFT_PILL_GAP}px`, '--lift-pill-pointer': `${pointer}px` },
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

// Looked up by the drawn picture, because a skill's picture has skins of its own.
const getUnitImage = (characterId: number, hexId: number): string => {
  const name = getCharacterName(characterId, hexId)
  return (
    (props.showSkin && gameDataStore.getOutfitImage(name)) || gameDataStore.getCharacterImage(name)
  )
}

// Phantimals reuse the character wrapper's positioning, drag, lift and
// perspective; only image and colour differ.

// A companion a phantimal spawned renders through the same branch, under its
// owner skill's companion portrait.
const phantimalUrl = (characterId: number) =>
  gameDataStore.getCharacterImage(gameDataStore.getPhantimalUnitSlug(characterId) ?? '')

// A phantimal id with no data is retired seasonal content: the id stays in the
// team (removable/replaceable like any unit) and renders as a placeholder.
const isRetiredPhantimal = (characterId: number): boolean =>
  inPhantimalBand(characterId) && !gameDataStore.getPhantimalById(phantimalOwnerId(characterId))

// Base character size (at 40px hex radius)
const BASE_CHARACTER_SIZE = 2 * PORTRAIT_RADIUS
const BASE_CHARACTER_OFFSET = PORTRAIT_RADIUS
const BASE_BADGE_SIZE = 22
const BASE_PIECE_SIZE = 32

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
const badgeDimensions = computed(() => {
  const size = Math.max(16, Math.round(BASE_BADGE_SIZE * ctx.hexScale))
  return {
    size,
    piece: Math.round((size * BASE_PIECE_SIZE) / BASE_BADGE_SIZE),
    hit: Math.max(28, size + 12),
    glyph: Math.round(size * 0.62),
    border: size >= 20 ? 2 : 1.5,
  }
})

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
    baseStyle.transform = ctx.layout.standingTransform(offset)
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

  // The id is the placed unit's (a companion or synergy id), not its base hero's.
  const from = { characterId, sourceHexId: hexId, sourceGridId: ctx.id }

  if (inPhantimalBand(characterId)) {
    const slug = gameDataStore.getPhantimalUnitSlug(characterId)
    if (!slug) return
    startDrag(event, from, gameDataStore.getCharacterImage(slug))
    return
  }

  const hero = gameDataStore.getCharacterById(toBaseHeroId(characterId))
  if (!hero) return
  startDrag(
    event,
    { ...from, hero },
    getUnitImage(characterId, hexId),
    duelBackdrops.value.get(hexId),
  )
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

  if (props.tapMode || isTouchClick(event)) {
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
      // Through the drop router, so a tap-swap shares every drag gate; a
      // refused swap silently no-ops and the lift is consumed either way.
      grids.routeLiftDrop(ctx.id, liftedHexId.value, ctx.id, hexId)
      clearLiftedHex()
    } else {
      setLiftedHex(hexId, ctx.id, characterId)
    }
    return
  }

  ctx.remove(hexId)
}

// Hover runs on readonly boards too: the card is pure information gated by
// the pref alone, and the emits just report the pointer; listeners own their
// interactivity policy (GridTiles ignores these on readonly).
// A unit's own card names the buff tile it stands on. A unit with no card of
// its own shows the buff's card, unless it is an ally whose card is Placement
// tips', which already names the tile.
const hoverCardAt = (hexId: number, characterId: number): HoverCard | undefined => {
  const enemy = getCharacterTeam(ctx.grid, hexId) === Team.ENEMY
  const buff = props.showBuffTiles ? buffAt(ctx.buffs, hexId) : undefined
  const card = props.showHover || (props.showRules && enemy) ? cardAt(characterId) : undefined
  const duel = duelMarkAt(hexId)
  const own = card?.kind === 'hero' && duel ? { ...card, duel } : card
  if (buff === undefined) return own
  if (own) return { ...own, buff }
  return props.showRules && !enemy ? undefined : { kind: 'buff', buff }
}

const handleMouseEnter = (event: MouseEvent, hexId: number, characterId: number) => {
  emit('unitEnter', hexId)
  show(event, hoverCardAt(hexId, characterId))
}

const handleMouseLeave = (hexId: number) => {
  emit('unitLeave', hexId)
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

interface ModeButton {
  hexId: number
  team: Team
  characterId: number
  icon: BadgeIcon
  mode: SkillMode
  next: number
}

// A mode is part of the hero's setup, so its button shows whatever the Skills
// toggle says. The lookup takes the exact id: a synergy copy cannot hold a
// mode, because a link's upgrade row cannot name its id.
const modeButtons = computed(() =>
  props.isMapEditorMode
    ? []
    : visiblePlacements.value.flatMap(([hexId, characterId]): ModeButton[] => {
        const entry = SKILL_MODES[characterId]
        const team = getCharacterTeam(ctx.grid, hexId)
        if (!entry || !team) return []
        const position = ctx.getAttr(team, characterId, ATTR_SKILL_MODE)
        const mode = entry.modes[position]
        if (!mode) return []
        const next = (position + 1) % entry.modes.length
        return [{ hexId, team, characterId, icon: entry.icon, mode, next }]
      }),
)

// A skill's badges picture what it does, so they follow the Skills toggle.
const skillBadges = computed(() => {
  if (!props.showSkills) return []
  const shown = new Set(visiblePlacements.value.map(([hexId]) => hexId))
  return ctx.skillBadges.filter((badge) => shown.has(badge.hexId))
})

// An Honor Duel board marks what each hero carries on its portrait, so the
// board alone, and a picture of it, tells the formation. The hero card's own
// controls set them from the portrait.
interface DuelMark {
  hexId: number
  team: Team
  unitId: number
  trial: boolean
  tier: DuelTier
  // The tier's place in DUEL_TIERS.
  tierAt: number
  tierChoice: boolean
  copyChoice: boolean
  pieceId: number
  piece: DuelItemView | null
}

const { pieceOf } = useDuelItems()

const duelMarks = computed((): DuelMark[] =>
  ctx.kind !== 'honorDuel' || props.isMapEditorMode
    ? []
    : visiblePlacements.value.flatMap(([hexId, unitId]) => {
        const team = getCharacterTeam(ctx.grid, hexId)
        if (!team || !isHeroUnit(unitId)) return []
        const tierAt = ctx.getAttr(team, unitId, DUEL_ATTR_TIER)
        const pieceId = ctx.getAttr(team, unitId, DUEL_ATTR_EQUIPMENT)
        return [
          {
            hexId,
            team,
            unitId,
            trial: isTrialHeroId(unitId),
            tier: DUEL_TIERS[tierAt] ?? DUEL_TIERS[0],
            tierAt,
            tierChoice: hasDuelTierChoice(unitId),
            copyChoice: duelOtherCopy(ctx, team, unitId) !== null,
            pieceId,
            piece: pieceOf(pieceId),
          },
        ]
      }),
)

const duelMarkAt = (hexId: number | null): DuelMark | undefined =>
  duelMarks.value.find((mark) => mark.hexId === hexId)

const duelBackdrops = computed(
  () => new Map(duelMarks.value.map((mark) => [mark.hexId, tierBackdrop(mark.tier)])),
)

const setDuelTier = ({ team, unitId }: DuelMark, tier: number): void =>
  ctx.setAttr(team, unitId, DUEL_ATTR_TIER, tier)

// A lift names its unit, and the copy is another unit on the same tile, so the
// lift moves to it and the controls over the unit stay open.
const swapLiftedCopy = ({ hexId, team, unitId }: DuelMark): void => {
  const copy = swapDuelCopy(ctx, team, unitId)
  if (copy !== null) setLiftedHex(hexId, ctx.id, copy)
}

const picking = ref<DuelPiecePick | null>(null)
const pickPiece = ({ team, unitId }: DuelMark, position: Point): void => {
  picking.value = { team, unitId, position }
}

// Past the portrait the control sits on, so the unit stays in view.
const besideUnit = (control: DOMRect): Point => ({
  x: control.left + characterDimensions.value.size + 12,
  y: control.top,
})

// A piece dragged from the list goes to the unit it is let go on. A drag that
// ends over a unit may fire no dragleave, so the highlight ends with the drag.
const { isDraggingPiece, carriesPiece, droppedPiece } = useDuelPieceDrag()
const pieceOverHexId = ref<number | null>(null)
watch(isDraggingPiece, (dragging) => {
  if (!dragging) pieceOverHexId.value = null
})

const pieceTargetAt = (event: DragEvent, hexId: number): DuelMark | undefined =>
  props.readonly || !carriesPiece(event) ? undefined : duelMarkAt(hexId)

const handlePieceDragOver = (event: DragEvent, hexId: number): void => {
  if (!pieceTargetAt(event, hexId)) return
  event.preventDefault()
  pieceOverHexId.value = hexId
}

const handlePieceDrop = (event: DragEvent, hexId: number): void => {
  const mark = pieceTargetAt(event, hexId)
  const piece = droppedPiece(event)
  if (!mark || piece === null) return
  event.preventDefault()
  // Off the document's drop listener, which routes hero drops.
  event.stopPropagation()
  setDuelEquipment(ctx, mark.team, mark.unitId, piece)
}

// The unit the pointer is on, by its portrait or a control on it. The controls
// sit outside the portrait's element, so the layer follows the pointer across
// both.
const {
  hovered: pointedHexId,
  show: point,
  hide: unpoint,
} = useGridHoverTooltip<number>(() => ctx.placements)
const pointAt = (event: MouseEvent, target: EventTarget | null): void => {
  const unit = target instanceof Element ? target.closest<HTMLElement>('[data-unit-hex]') : null
  // Tile numbers repeat on every board, so only a unit of this layer counts.
  if (unit && (event.currentTarget as Element).contains(unit)) {
    point(event, Number(unit.dataset.unitHex))
  } else {
    unpoint()
  }
}

// On a board that can be edited, the unit under the pointer shows the controls
// it has no mark for at rest: an empty equipment slot, its tier, and the empty
// Trial slot of a hero that can change to a Trial copy.
const pointedMark = computed(() => (props.readonly ? undefined : duelMarkAt(pointedHexId.value)))

// The lift pill is centred on its unit, so by the board's side it can run past
// the screen's edge. Its measured overhang slides it back in, and its pointer
// stays over the unit.
const LIFT_PILL_EDGE = 4
const liftShift = ref(0)
watch(
  [liftPill, liftActionsEl],
  () => {
    const pill = liftActionsEl.value?.getBoundingClientRect()
    if (!pill) return
    const left = pill.left - liftShift.value
    const right = pill.right - liftShift.value
    const edge = document.documentElement.clientWidth - LIFT_PILL_EDGE
    liftShift.value = Math.max(LIFT_PILL_EDGE - left, 0) + Math.min(edge - right, 0)
  },
  { flush: 'post' },
)

const badgeStyle = computed(() => {
  const { size, piece, hit, border } = badgeDimensions.value
  return {
    '--badge-rim': `${(characterDimensions.value.size / 2) * Math.SQRT1_2}px`,
    '--badge-size': `${size}px`,
    '--piece-size': `${piece}px`,
    '--badge-border': `${border}px`,
    '--mode-hit': `${hit}px`,
  }
})

const cycleMode = ({ team, characterId, next }: ModeButton): void =>
  ctx.setAttr(team, characterId, ATTR_SKILL_MODE, next)

const {
  anchor: modeAnchor,
  payload: modeHexId,
  onMouseEnter: onModeEnter,
  onMouseLeave: onModeLeave,
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
  <div
    class="character-layer"
    :class="{ 'piece-in-hand': isDraggingPiece }"
    :style="badgeStyle"
    @mouseover="pointAt($event, $event.target)"
    @mouseout="pointAt($event, $event.relatedTarget)"
  >
    <div
      v-for="[hexId, characterId] in visiblePlacements"
      :key="hexId"
      class="character inspectable"
      :class="{
        'map-editor-disabled': isMapEditorMode,
        readonly: readonly,
        lifted: liftedHexId === hexId && liftedGridId === ctx.id,
        'rules-faded': faded?.has(hexId),
        'piece-target': pieceOverHexId === hexId,
      }"
      :style="getCharacterStyle(hexId)"
      :data-unit-hex="hexId"
      :draggable="!isMapEditorMode && !readonly"
      @dragstart="!readonly && handleDragStart($event, hexId, characterId)"
      @dragend="!readonly && handleDragEnd($event)"
      @dragover="handlePieceDragOver($event, hexId)"
      @dragleave="pieceOverHexId = null"
      @drop="handlePieceDrop($event, hexId)"
      @click="!readonly && handleClick($event, hexId, characterId)"
      @pointerdown="handlePointerDown($event, hexId, characterId)"
      @contextmenu="handleContextMenu($event, hexId, characterId)"
      @mouseenter="handleMouseEnter($event, hexId, characterId)"
      @mouseleave="handleMouseLeave(hexId)"
    >
      <div class="character-content">
        <!-- draggable=false keeps the wrapper div as the drag source. Images are
             draggable by default, and a swap can replace this node mid-drag
             (character↔phantimal flips the v-if branch). Dragend fired on a
             detached source never reaches the wrapper or document listeners,
             leaving the drag ghost stuck. -->
        <span
          v-if="isRetiredPhantimal(characterId)"
          class="character-image phantimal retired-unit"
          :style="{ fontSize: `${characterDimensions.size * 0.4}px` }"
          :title="i18n.t('app.retired')"
        >
          ?
        </span>
        <img
          v-else-if="inPhantimalBand(characterId)"
          :src="phantimalUrl(characterId)"
          :alt="unitName(characterId)"
          class="character-image phantimal"
          draggable="false"
        />
        <img
          v-else
          :src="getUnitImage(characterId, hexId)"
          :alt="unitName(characterId)"
          class="character-image"
          :style="{ backgroundImage: duelBackdrops.get(hexId) }"
          draggable="false"
        />
        <GridPointer v-if="ctx.perspective" />
        <HoldRing v-if="holdingHexId === hexId" />
      </div>
    </div>

    <!-- Controls sit in a box placed and transformed like their sprite, so they
         move with it while the view switches. -->
    <div
      v-for="button in modeButtons"
      :key="`mode-${button.hexId}`"
      class="sprite-anchor"
      :style="getCharacterStyle(button.hexId)"
    >
      <button
        type="button"
        class="skill-mode badge-upper-right"
        :disabled="readonly"
        :aria-label="i18n.t(`app.${button.mode.name}`)"
        @click="cycleMode(button)"
        @mouseenter="(showHover || showRules) && onModeEnter($event, button.hexId)"
        @mouseleave="onModeLeave"
        @contextmenu="handleContextMenu($event, button.hexId, button.characterId)"
      >
        <UnitBadge :icon="button.icon" :color="button.mode.color" :glyph="badgeDimensions.glyph" />
      </button>
    </div>

    <div
      v-for="badge in skillBadges"
      :key="`badge-${badge.hexId}-${badge.icon}`"
      class="sprite-anchor"
      :style="getCharacterStyle(badge.hexId)"
    >
      <UnitBadge
        class="badge-upper-left"
        :icon="badge.icon"
        :color="badge.color"
        :glyph="badgeDimensions.glyph"
      />
    </div>

    <template v-for="mark in duelMarks" :key="`duel-${mark.hexId}`">
      <div
        v-if="mark.piece || mark.trial || mark === pointedMark"
        class="sprite-anchor"
        :style="getCharacterStyle(mark.hexId)"
        :data-unit-hex="mark.hexId"
        @contextmenu="handleContextMenu($event, mark.hexId, mark.unitId)"
      >
        <span
          v-if="mark.piece || mark === pointedMark"
          class="duel-control duel-piece badge-upper-left"
          :class="{ 'capture-exclude': !mark.piece }"
        >
          <DuelPieceSlot
            :piece="mark.pieceId"
            :readonly
            @open="pickPiece(mark, besideUnit($event))"
          />
        </span>
        <span
          v-if="mark.trial || (mark === pointedMark && mark.copyChoice)"
          class="duel-control badge-upper-right"
          :class="{ 'capture-exclude': !mark.trial }"
        >
          <DuelTrialToggle
            :trial="mark.trial"
            :fixed="readonly || !mark.copyChoice"
            @toggle="swapDuelCopy(ctx, mark.team, mark.unitId)"
          />
        </span>
        <span
          v-if="mark === pointedMark && mark.tierChoice"
          class="duel-control badge-lower-left capture-exclude"
        >
          <DuelTierPill
            :unit-id="mark.unitId"
            :tier="mark.tierAt"
            @pick="setDuelTier(mark, $event)"
          />
        </span>
      </div>
    </template>

    <div v-if="liftPill" class="sprite-anchor" :style="getCharacterStyle(liftPill.hexId)">
      <div
        ref="liftActionsEl"
        class="lift-actions capture-exclude"
        :class="{ below: liftPill.below }"
        :style="[liftPill.style, { '--lift-pill-shift': `${liftShift}px` }]"
      >
        <button
          v-if="liftedMode && !readonly"
          type="button"
          class="lift-mode"
          :aria-label="i18n.t(`app.${liftedMode.mode.name}`)"
          @click="cycleMode(liftedMode)"
        >
          <UnitBadge :icon="liftedMode.icon" :color="liftedMode.mode.color" :glyph="11" />
        </button>
        <span v-if="liftPill.duel" class="lift-duel">
          <DuelTierPill
            v-if="liftPill.duel.tierChoice"
            :unit-id="liftPill.duel.unitId"
            :tier="liftPill.duel.tierAt"
            @pick="setDuelTier(liftPill.duel, $event)"
          />
          <DuelPieceSlot
            :piece="liftPill.duel.pieceId"
            @open="pickPiece(liftPill.duel, below($event))"
          />
          <DuelTrialToggle
            v-if="liftPill.duel.copyChoice"
            :trial="liftPill.duel.trial"
            @toggle="swapLiftedCopy(liftPill.duel)"
          />
        </span>
        <button
          v-if="liftPill.inspectable"
          type="button"
          class="lift-inspect"
          @click="inspectAt(liftPill.hexId)"
        >
          <IconInfo :size="16" />
          {{ i18n.t('app.skills') }}
        </button>
      </div>
    </div>

    <DuelPiecePicker v-model="picking" :context="ctx" />

    <TooltipPopup v-if="hoveredMode && modeAnchor" :target-element="modeAnchor" variant="simple">
      <template #content>{{ i18n.t(`app.${hoveredMode.name}`) }}</template>
    </TooltipPopup>

    <CharacterTooltip
      v-if="hoveredEl && hoveredCard?.kind === 'hero'"
      :character="hoveredCard.hero"
      :target-element="hoveredEl"
      variant="detailed"
      :hint="hoverHint"
    >
      <DuelTierChips
        v-if="hoveredCard.duel"
        :tier="hoveredCard.duel.tier"
        :trial="hoveredCard.duel.trial"
        :piece="hoveredCard.duel.piece?.label"
      />
      <BuffTileText v-if="hoveredCard.buff" :buff="hoveredCard.buff" heading />
    </CharacterTooltip>
    <PhantimalTooltip
      v-else-if="hoveredEl && hoveredCard?.kind === 'phantimal'"
      :phantimal="hoveredCard.phantimal"
      :target-element="hoveredEl"
      :hint="hoverHint"
    >
      <BuffTileText v-if="hoveredCard.buff" :buff="hoveredCard.buff" heading />
    </PhantimalTooltip>
    <BuffTileTooltip
      v-else-if="hoveredEl && hoveredCard?.kind === 'buff'"
      :buff="hoveredCard.buff"
      :target-element="hoveredEl"
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
}

.switching .character,
.switching .sprite-anchor {
  transition: transform var(--transition-perspective);
}

.character:active {
  cursor: grabbing;
}

.character.map-editor-disabled {
  pointer-events: none;
  cursor: default;
}

.character.readonly {
  cursor: default;
}

.character.rules-faded {
  opacity: 0.35;
}

.character-content {
  width: 100%;
  height: 100%;
  position: relative;
  transition: transform 0.15s ease-out;
}

/* Lift styling lives on the inner element because the wrapper's inline
   transform carries the perspective skew. */
.character.lifted .character-content,
.character.piece-target .character-content {
  transform: scale(1.08);
}

.character.lifted .character-content {
  filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.28));
}

.character.piece-target .character-content {
  filter: drop-shadow(0 0 3px var(--tile-highlight-stroke))
    drop-shadow(0 0 8px var(--tile-highlight-stroke));
}

.sprite-anchor {
  pointer-events: none;
  z-index: var(--z-board-controls);
}

.badge-upper-right,
.badge-upper-left,
.badge-lower-left {
  position: absolute;
  top: calc(50% - var(--badge-rim));
  transform: translate(-50%, -50%);
}

.badge-upper-right {
  left: calc(50% + var(--badge-rim));
}

.badge-upper-left,
.badge-lower-left {
  left: calc(50% - var(--badge-rim));
}

.badge-lower-left {
  top: calc(50% + var(--badge-rim));
}

.duel-piece {
  --badge-size: var(--piece-size);
}

.duel-control,
.lift-duel {
  --slot-fill: var(--color-bg-raised);
  display: flex;
}

.duel-control.badge-lower-left {
  --hit-reach: 6px;
}

.duel-control > button {
  pointer-events: auto;
}

.piece-in-hand .character-content,
.piece-in-hand .sprite-anchor * {
  pointer-events: none;
}

.skill-mode {
  width: var(--mode-hit);
  height: var(--mode-hit);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  pointer-events: auto;
  cursor: pointer;
}

.skill-mode:disabled {
  pointer-events: none;
}

.skill-mode:focus-visible {
  outline: none;
}

.skill-mode:focus-visible .unit-badge {
  transform: scale(1.25);
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

@media (hover: hover) {
  .skill-mode:hover .unit-badge {
    transform: scale(1.25);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
}

@media not all and (any-pointer: fine) {
  .skill-mode,
  .duel-control > button {
    pointer-events: none;
  }
}

.lift-actions {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(calc(-50% + var(--lift-pill-shift)), calc(-100% - var(--lift-pill-gap)));
  display: flex;
  align-items: center;
  border-radius: 999px;
  background: var(--color-primary);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
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

.lift-mode,
.lift-duel {
  --badge-size: 18px;
  --badge-border: 1.5px;
  padding: 3px 0 3px 3px;
}

.lift-duel {
  align-items: center;
  gap: 8px;
}

.lift-duel:last-child {
  padding-right: 3px;
}

.lift-actions::after {
  content: '';
  position: absolute;
  left: calc(50% - var(--lift-pill-shift));
  bottom: -5px;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom: 0;
  border-top-color: var(--color-primary);
}

.lift-actions.below {
  top: calc(100% + var(--lift-pill-pointer));
  transform: translate(calc(-50% + var(--lift-pill-shift)), var(--lift-pill-gap));
}

.lift-actions.below::after {
  top: -5px;
  bottom: auto;
  border: 5px solid transparent;
  border-top: 0;
  border-bottom-color: var(--color-primary);
}

.retired-unit {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  user-select: none;
}

/* The disc is a shadow on this box because image export rounds separate boxes to whole
   pixels independently, which pushes stacked circles off-centre. */
.character-image {
  --disc: var(--unit-disc);
  position: absolute;
  top: var(--character-border-width, 3px);
  left: var(--character-border-width, 3px);
  width: calc(100% - 2 * var(--character-border-width, 3px));
  height: calc(100% - 2 * var(--character-border-width, 3px));
  border-radius: 50%;
  object-fit: cover;
  border: var(--character-border-width, 3px) solid var(--unit-ring);
  background-color: var(--disc);
  box-shadow: 0 0 0 var(--character-border-width, 3px) var(--disc);
}

.character-image.phantimal {
  --disc: var(--unit-disc-phantimal);
}
</style>
