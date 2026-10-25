<script setup lang="ts">
import { computed } from 'vue'

import HoldRing from './ui/HoldRing.vue'
import TooltipCard from './ui/TooltipCard.vue'
import TooltipPopup from './ui/TooltipPopup.vue'
import { useDragDrop } from '@/composables/useDragDrop'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { usePressClick } from '@/composables/usePressClick'
import { useSelectionState } from '@/composables/useSelectionState'
import { useUnitTooltipRows } from '@/composables/useUnitTooltipRows'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { PHANTIMAL_FACTION_REQUIREMENT } from '@/lib/characters/phantimalFaction'
import type { CharacterType } from '@/lib/types/character'
import type { PhantimalType } from '@/lib/types/phantimal'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { phantimalDisplayName } from '@/utils/nameFormatting'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

const { phantimals, isDraggable = false } = defineProps<{
  phantimals: readonly PhantimalType[]
  isDraggable?: boolean
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const grids = useGrids()
const { traitRow, rangeRow } = useUnitTooltipRows()
const { fillOrder, targetHexId, targetGridId, clearTargetHex, characterStore } = useSelectionState()
const { startDrag, endDrag } = useDragDrop()

const sorted = computed(() => [...phantimals].sort((a, b) => a.id - b.id))

// "Season 7 Phantimals": season number comes from the data.
const heading = computed(() => {
  const season = sorted.value[0]?.season ?? 0
  return `${i18n.t('game.season')} ${season} ${i18n.t('game.phantimal')}`
})

const placedHexForTeam = (phantimal: PhantimalType, team: Team) => {
  const id = toPhantimalId(phantimal.id)
  const tile = characterStore
    .getTilesWithCharacters()
    .find((t) => t.characterId === id && t.team === team)
  return tile ? tile.hex.getId() : null
}

// The side a click fills. Each side fields one phantimal, and both may field
// the same one.
const openTeam = (phantimal: PhantimalType): Team | null => {
  const id = toPhantimalId(phantimal.id)
  return (
    fillOrder.find(
      (team) =>
        characterStore.findTeamPhantimalHex(team) === null &&
        characterStore.phantimalCanJoinTeam(id, team),
    ) ?? null
  )
}

// With no side open, a click takes the phantimal off where it stands, the side
// filled last first; the picker greys it out to say so.
const removableHex = (phantimal: PhantimalType): number | null => {
  if (openTeam(phantimal) !== null) return null
  for (const team of [...fillOrder].reverse()) {
    const hex = placedHexForTeam(phantimal, team)
    if (hex !== null) return hex
  }
  return null
}

const handlePhantimalClick = (phantimal: PhantimalType) => {
  const id = toPhantimalId(phantimal.id)
  // Mobile: a tapped tile targets a specific cell on its board. Place there using
  // its team, on that board (not whichever board is active).
  if (targetHexId.value !== null && targetGridId.value !== null) {
    const ctx = grids.getContext(targetGridId.value)
    if (ctx) {
      const team = getTeamFromTileState(ctx.grid.getTileById(targetHexId.value).state)
      if (team !== null) ctx.placePhantimal(targetHexId.value, id, team)
    }
    clearTargetHex()
    return
  }
  const team = openTeam(phantimal)
  if (team !== null) {
    characterStore.autoPlacePhantimal(id, team)
    return
  }
  const hex = removableHex(phantimal)
  if (hex !== null) {
    characterStore.removeCharacterFromHex(hex)
    return
  }
  // Standing nowhere with no side open, it replaces the phantimal of the first
  // side it can join.
  for (const team of fillOrder) {
    if (characterStore.autoPlacePhantimal(id, team)) break
  }
}

// A drag must not also fire a placement, so clicks are press-duration gated.
const { onMouseDown, onMouseUp, cancel: cancelPress } = usePressClick(handlePhantimalClick)

const handleDragStart = (event: DragEvent, phantimal: PhantimalType) => {
  if (!isDraggable) return
  const id = toPhantimalId(phantimal.id)
  // Minimal character-shaped payload: the drop handler only needs the id (no
  // sourceHexId marks it as a picker placement).
  const dragData = { id } as unknown as CharacterType
  startDrag(event, dragData, id, gameDataStore.getCharacterImage(phantimal.name))
}

const handleDragEnd = (event: DragEvent) => {
  if (isDraggable) endDrag(event)
}

// Hover tooltip: whether the phantimal can currently be deployed on the side a
// click fills, with the faction unit count. One shared popup follows the
// hovered icon; portraits are action triggers (tap places), so touch gets none.
const {
  anchor: hoveredEl,
  payload: hovered,
  onMouseEnter: onPortraitEnter,
  onMouseLeave: onPortraitLeave,
  onTouchStart: onPortraitTouchStart,
} = useHoverTooltip<PhantimalType>()

const tooltipName = computed(() => {
  const phantimal = hovered.value
  if (!phantimal) return ''
  return phantimalDisplayName(i18n.currentLocale, phantimal.name)
})

const tooltipRows = computed(() => {
  const phantimal = hovered.value
  if (!phantimal) return []
  const id = toPhantimalId(phantimal.id)
  const team = openTeam(phantimal) ?? fillOrder[0]
  const count = characterStore.phantimalFactionCount(id, team)
  const key = characterStore.phantimalCanJoinTeam(id, team)
    ? 'app.phantimal-deployable'
    : 'app.phantimal-locked'
  return [
    traitRow('faction', phantimal.faction),
    traitRow('damage', phantimal.damage),
    rangeRow(phantimal.range),
    {
      label: `${i18n.t('app.availability')}:`,
      value: i18n.t(key, { count, required: PHANTIMAL_FACTION_REQUIREMENT }),
    },
  ]
})

// Right-click or hold opens the phantimal's details, as on the board.
const { inspect } = useInspect()
const {
  pressing,
  start: startHold,
  onContextMenu,
} = useLongPress<PhantimalType>((phantimal) => {
  onPortraitLeave()
  void inspect({ kind: 'phantimal', phantimal })
})

const handleContextMenu = (event: MouseEvent, phantimal: PhantimalType): void => {
  cancelPress()
  onContextMenu(event, phantimal)
}
</script>

<template>
  <section v-if="sorted.length" class="phantimal-section">
    <h3 class="phantimal-section-title">{{ heading }}</h3>
    <div class="phantimals">
      <div v-for="phantimal in sorted" :key="phantimal.id" class="phantimal-profile">
        <div
          class="phantimal"
          :class="{ draggable: isDraggable, 'greyed-out': removableHex(phantimal) !== null }"
          :draggable="isDraggable"
          @dragstart="handleDragStart($event, phantimal)"
          @dragend="handleDragEnd"
          @mousedown="onMouseDown"
          @mouseup="onMouseUp(phantimal)"
          @pointerdown="startHold($event, phantimal)"
          @contextmenu="handleContextMenu($event, phantimal)"
          @mouseenter="onPortraitEnter($event, phantimal)"
          @mouseleave="onPortraitLeave"
          @touchstart.passive="onPortraitTouchStart"
        >
          <img
            :src="gameDataStore.getCharacterImage(phantimal.name)"
            :alt="phantimal.name"
            class="portrait"
            loading="lazy"
            decoding="async"
          />
        </div>
        <HoldRing v-if="pressing === phantimal" />
      </div>
    </div>

    <Teleport to="body">
      <TooltipPopup v-if="hovered && hoveredEl" :target-element="hoveredEl" variant="detailed">
        <template #content>
          <TooltipCard
            :name="tooltipName"
            :rows="tooltipRows"
            :hint="i18n.t('app.hold-for-details')"
          />
        </template>
      </TooltipPopup>
    </Teleport>
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

/* Positioned so the hold ring can sit outside the portrait's clipped circle. */
.phantimal-profile {
  position: relative;
  margin-top: var(--spacing-xs);
}

.phantimal {
  width: 70px;
  height: 70px;
  position: relative;
  border-radius: var(--radius-round);
  border: 2px solid var(--color-bg-raised);
  background: var(--color-bg-raised);
  overflow: hidden;
  box-shadow: 0 0 0 2px var(--color-bg-raised);
  padding: 0;
  cursor: pointer;
  transition: transform var(--transition-fast);
  /* A long-press is the inspect gesture: iOS would otherwise answer it with
     the image callout, and every touch browser with text selection. */
  -webkit-touch-callout: none;
  user-select: none;
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

.portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
