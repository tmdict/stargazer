<script setup lang="ts">
/* A map's board in the set. Hovering or tapping a unit or the artifact shows
   why it stands where it does, rings it and the units the card names and
   outlines the free tiles the unit could take as well (dashed) or better
   (green). A swap tried below the board draws its heroes on the tiles they
   would take and fades the units that leave. Right-click opens a unit's or
   the artifact's skills. */

import { computed, useTemplateRef } from 'vue'

import SlPlacementCard from './SlPlacementCard.vue'
import BoardThumbnail from '@/components/grid/BoardThumbnail.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { unitInspectTarget, useInspect, type InspectTarget } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { usePreviewImages } from '@/composables/usePreviewImages'
import { inPhantimalBand, phantimalBandLocal } from '@/lib/characters/phantimal'
import { decomposeUnitId } from '@/lib/characters/synergy'
import {
  cardRings,
  hasCard,
  type PlacementExplanation,
  type UnitPlacement,
} from '@/lib/placement/explain'
import type { SwapPreview } from '@/lib/pvp/generator/swapPreview'
import { previewUnitId, type PreviewBoard, type PreviewUnit } from '@/lib/teams/preview'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { isTouchClick } from '@/utils/pointer'

const {
  board,
  why = null,
  swap = null,
} = defineProps<{
  board: PreviewBoard
  why?: PlacementExplanation | null
  swap?: SwapPreview | null
}>()

// The artifact's card has no unit and no tiles of its own.
type Shown = Pick<UnitPlacement, 'reasons' | 'alsoFine' | 'better'> & { unit?: number }

const gameData = useGameDataStore()
const { thumbnailUnit, thumbnailArtifact } = usePreviewImages()
const {
  anchor,
  payload: shown,
  hoverOpen,
  hoverClose,
  toggle,
  onTouchStart,
  close,
} = useInfoTip<Shown>()
const thumbnailView = useTemplateRef<InstanceType<typeof BoardThumbnail>>('thumbnail')

// The unit on a tile, when it has a card.
const entryOn = (tile: number): UnitPlacement | undefined =>
  why?.units.find((entry) => entry.tile === tile && hasCard(entry))

const shownAt = (target: EventTarget | null): [Element, Shown] | null => {
  if (!why || !(target instanceof Element)) return null
  const unit = target.closest<SVGElement>('[data-hex]')
  if (unit) {
    const entry = entryOn(Number(unit.dataset.hex))
    return entry ? [unit, entry] : null
  }
  const artifact = target.closest('[data-artifact="ally"]')
  return artifact && why.artifact.length
    ? [artifact, { reasons: why.artifact, alsoFine: [], better: [] }]
    : null
}

const onOver = (event: Event): void => {
  const found = shownAt(event.target)
  if (found) hoverOpen(...found)
}

const onClick = (event: Event): void => {
  const found = shownAt(event.target)
  if (found) toggle(...found)
}

// The unit drawn on each tile, a swap's included.
const unitIds = computed(() => {
  const ids = new Map<number, number>()
  for (const unit of board.units) {
    const id = previewUnitId(unit)
    if (id !== undefined) ids.set(unit.hexId, id)
  }
  for (const [hexId, unit] of swap?.joined ?? []) ids.set(hexId, unit)
  return ids
})

const inspectedAt = (target: EventTarget | null): InspectTarget | null => {
  if (!(target instanceof Element)) return null
  const unit = target.closest<SVGElement>('[data-hex]')
  if (unit) {
    const id = unitIds.value.get(Number(unit.dataset.hex))
    return id === undefined ? null : unitInspectTarget(id)
  }
  const slot = target.closest('[data-artifact="ally"]') ? board.artifacts.ally : null
  const artifact = typeof slot === 'number' ? gameData.getArtifactById(slot) : undefined
  return artifact ? { kind: 'artifact', artifact } : null
}

const { inspect } = useInspect()
const { onContextMenu } = useLongPress<InspectTarget>((target) => {
  close()
  void inspect(target)
})

// A touch long-press is left to the browser: this board has no hold gesture.
const onRightClick = (event: MouseEvent): void => {
  const target = inspectedAt(event.target)
  if (target && !isTouchClick(event)) onContextMenu(event, target)
}

const lit = computed(() =>
  shown.value && why ? cardRings(why, shown.value.reasons, shown.value.unit) : null,
)

const drawnOn = (hexId: number, unit: number): PreviewUnit => ({
  hexId,
  team: Team.ALLY,
  ...(inPhantimalBand(unit)
    ? { phantimalLocal: phantimalBandLocal(unit) }
    : { characterId: decomposeUnitId(unit).localId }),
})

// A unit that joins on the tile of one that leaves takes its place.
const units = computed(() => {
  const joined = swap?.joined ?? []
  const taken = new Set(joined.map(([hexId]) => hexId))
  const left = new Set(swap?.left)
  return [
    ...board.units
      .filter((unit) => !taken.has(unit.hexId))
      .map((unit) => ({
        ...thumbnailUnit(unit),
        leaving: left.has(unit.hexId),
        focus: lit.value?.own.has(unit.hexId),
        highlight: lit.value?.named.has(unit.hexId),
        interactive: entryOn(unit.hexId) !== undefined,
      })),
    ...joined.map(([hexId, unit]) => thumbnailUnit(drawnOn(hexId, unit))),
  ]
})

const artifact = computed(() => {
  const ally = thumbnailArtifact(board.artifacts.ally)
  return (
    ally && {
      ...ally,
      focus: lit.value?.artifact === 'own',
      highlight: lit.value?.artifact === 'named',
      interactive: !!why?.artifact.length,
    }
  )
})

defineExpose({
  box: (): DOMRect => thumbnailView.value?.$el.getBoundingClientRect() ?? new DOMRect(),
})

// Over its unit and above the board's ally tiles, so a card covers none of
// the tiles it rings or outlines; with no room above, under them.
const unitCardAnchor = computed(() => {
  const el = anchor.value
  return (
    el && {
      getBoundingClientRect: (): DOMRect => {
        const box = el.getBoundingClientRect()
        const allies = thumbnailView.value?.zoneBox('ally') ?? box
        return new DOMRect(box.x, allies.y, box.width, allies.height)
      },
    }
  )
})
</script>

<template>
  <BoardThumbnail
    ref="thumbnail"
    class="sl-board"
    :map-key="board.mapKey"
    :tiles="board.tiles"
    :units
    :artifacts="{ ally: artifact }"
    :hex-size="18"
    crisp
    fine-ring
    :outlined="shown?.alsoFine"
    :better="shown?.better"
    @mouseover="onOver"
    @mouseout="hoverClose"
    @click="onClick"
    @contextmenu="onRightClick"
    @touchstart.passive="onTouchStart"
  />
  <SlPlacementCard
    v-if="unitCardAnchor && shown"
    :anchor="unitCardAnchor"
    :reasons="shown.reasons"
    :also-fine="shown.alsoFine.length > 0"
    :better="shown.better.length > 0"
  />
</template>

<style scoped>
.sl-board {
  width: 100%;
  height: auto;
}
</style>
