<script setup lang="ts">
/* A map's board in the set. On a board the engine placed, hovering or tapping a
   unit or the artifact shows why it stands where it does, rings it and the units
   the card names and outlines the free tiles the unit could take as well. A swap
   tried below the board draws its heroes on the tiles they would take and fades
   the units that leave. */

import { computed, useTemplateRef } from 'vue'

import SlPlacementCard from './SlPlacementCard.vue'
import SlSwapCard from './SlSwapCard.vue'
import BoardThumbnail from '@/components/grid/BoardThumbnail.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { usePreviewImages } from '@/composables/usePreviewImages'
import { inPhantimalBand, phantimalBandLocal } from '@/lib/characters/phantimal'
import { decomposeUnitId } from '@/lib/characters/synergy'
import type { PlacementExplanation, UnitPlacement } from '@/lib/placement/explain'
import { ruleUnit } from '@/lib/placement/reach'
import type { SwapPreview } from '@/lib/pvp/sl/generator/swapPreview'
import type { PreviewBoard, PreviewUnit } from '@/lib/teams/preview'
import { Team } from '@/lib/types/team'

const {
  board,
  why = null,
  swap = null,
} = defineProps<{
  board: PreviewBoard
  why?: PlacementExplanation | null
  // The heroes swapped in, where the units go, and the chance to win the map
  // without the swap.
  swap?: { into: number[]; preview: SwapPreview; before: number } | null
}>()

// The artifact's card has no unit and no tiles of its own.
type Shown = Pick<UnitPlacement, 'reasons' | 'alsoFine'> & { unit?: number }

const { thumbnailUnit, thumbnailArtifact } = usePreviewImages()
const { anchor, payload: shown, hoverOpen, hoverClose, toggle, onTouchStart } = useInfoTip<Shown>()
const thumbnailView = useTemplateRef<InstanceType<typeof BoardThumbnail>>('thumbnail')

// The unit on a tile, when it has a card.
const entryOn = (tile: number): UnitPlacement | undefined =>
  why?.units.find((entry) => entry.tile === tile && (entry.reasons.length || entry.alsoFine.length))

const shownAt = (target: EventTarget | null): [Element, Shown] | null => {
  if (!why || !(target instanceof Element)) return null
  const unit = target.closest<SVGElement>('[data-hex]')
  if (unit) {
    const entry = entryOn(Number(unit.dataset.hex))
    return entry ? [unit, entry] : null
  }
  const artifact = target.closest('[data-artifact="ally"]')
  return artifact && why.artifact.length
    ? [artifact, { reasons: why.artifact, alsoFine: [] }]
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

// The card's own hero (its companion with it) or the artifact, and the heroes
// and artifact the card names, each by tile.
const lit = computed(() => {
  const entry = shown.value
  if (!entry || !why) return null
  const named = new Set<number>()
  let artifact = false
  for (const reason of entry.reasons) {
    if (reason.verb === 'stands') {
      if (reason.hero !== undefined) named.add(reason.hero)
      continue
    }
    for (const hero of reason.heroes) named.add(hero)
    if (reason.verb === 'receives') {
      if (reason.effect.giver === undefined) artifact = true
      else named.add(reason.effect.giver)
    }
  }
  const tilesOf = (heroes: Set<number>) =>
    new Set(why.units.filter(({ unit }) => heroes.has(ruleUnit(unit))).map(({ tile }) => tile))
  const own = entry.unit === undefined ? undefined : ruleUnit(entry.unit)
  return {
    own: tilesOf(new Set(own === undefined ? [] : [own])),
    named: tilesOf(named),
    artifact: own === undefined ? 'own' : artifact ? 'named' : undefined,
  }
})

const drawnOn = (hexId: number, unit: number): PreviewUnit => ({
  hexId,
  team: Team.ALLY,
  ...(inPhantimalBand(unit)
    ? { phantimalLocal: phantimalBandLocal(unit) }
    : { characterId: decomposeUnitId(unit).localId }),
})

// A unit that joins on the tile of one that leaves takes its place.
const units = computed(() => {
  const joined = swap?.preview.joined ?? []
  const taken = new Set(joined.map(([hexId]) => hexId))
  const left = new Set(swap?.preview.left)
  return [
    ...board.units
      .filter((unit) => !taken.has(unit.hexId))
      .map((unit) => ({
        ...thumbnailUnit(unit),
        faded: left.has(unit.hexId),
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

// Over its units and above the board's ally tiles, so a card covers none of
// the tiles it rings, outlines or swaps; with no room above, under them.
const aboveAllies = (own: () => DOMRect) => ({
  getBoundingClientRect: (): DOMRect => {
    const box = own()
    const allies = thumbnailView.value?.zoneBox('ally') ?? box
    return new DOMRect(box.x, allies.y, box.width, allies.height)
  },
})

const unitCardAnchor = computed(() => {
  const el = anchor.value
  return el && aboveAllies(() => el.getBoundingClientRect())
})

const swapCardAnchor = computed(() => {
  if (!swap) return null
  const { into, preview } = swap
  const tiles = preview.joined.flatMap(([hexId, unit]) => (into.includes(unit) ? [hexId] : []))
  return aboveAllies(() => {
    const boxes = tiles.flatMap((hexId) => {
      const el = thumbnailView.value?.$el.querySelector(`[data-hex="${hexId}"]`)
      return el ? [el.getBoundingClientRect()] : []
    })
    if (!boxes.length) return new DOMRect()
    const left = Math.min(...boxes.map((box) => box.left))
    const right = Math.max(...boxes.map((box) => box.right))
    return new DOMRect(left, boxes[0]!.y, right - left, boxes[0]!.height)
  })
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
    @mouseover="onOver"
    @mouseout="hoverClose"
    @click="onClick"
    @touchstart.passive="onTouchStart"
  />
  <SlPlacementCard
    v-if="unitCardAnchor && shown"
    :anchor="unitCardAnchor"
    :reasons="shown.reasons"
    :also-fine="shown.alsoFine.length > 0"
  />
  <SlSwapCard
    v-if="swap && swapCardAnchor"
    :anchor="swapCardAnchor"
    :into="swap.into"
    :before="swap.before"
    :after="swap.preview.chance"
  />
</template>

<style scoped>
.sl-board {
  width: 100%;
  height: auto;
}
</style>
