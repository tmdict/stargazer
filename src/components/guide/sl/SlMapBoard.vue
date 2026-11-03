<script setup lang="ts">
/* A map's board in the set. On a board the engine placed, hovering or tapping a
   unit or the artifact shows why it stands where it does, rings the units the
   card names and outlines the free tiles the unit could take as well. */

import { computed } from 'vue'

import SlPlacementCard from './SlPlacementCard.vue'
import BoardThumbnail from '@/components/grid/BoardThumbnail.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { usePreviewImages } from '@/composables/usePreviewImages'
import type { PlacementExplanation, UnitPlacement } from '@/lib/placement/explain'
import { ruleUnit } from '@/lib/placement/reach'
import type { PreviewBoard } from '@/lib/teams/preview'

const { board, why = null } = defineProps<{
  board: PreviewBoard
  why?: PlacementExplanation | null
}>()

// The artifact's card has no unit and no tiles of its own.
type Shown = Pick<UnitPlacement, 'reasons' | 'alsoFine'> & { unit?: number }

const { thumbnailUnit, thumbnailArtifact } = usePreviewImages()
const { anchor, payload: shown, hoverOpen, hoverClose, toggle, onTouchStart } = useInfoTip<Shown>()

const shownAt = (target: EventTarget | null): [Element, Shown] | null => {
  if (!why || !(target instanceof Element)) return null
  const unit = target.closest<SVGElement>('[data-hex]')
  if (unit) {
    const entry = why.units.find(({ tile }) => tile === Number(unit.dataset.hex))
    return entry && (entry.reasons.length || entry.alsoFine.length) ? [unit, entry] : null
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

// The tiles of the units the card names, its own unit's among them, and
// whether it names the artifact.
const named = computed(() => {
  const entry = shown.value
  if (!entry || !why) return null
  const owners = new Set(entry.unit === undefined ? [] : [ruleUnit(entry.unit)])
  let artifact = entry.unit === undefined
  for (const reason of entry.reasons) {
    if (reason.verb === 'stands') {
      if (reason.hero !== undefined) owners.add(reason.hero)
      continue
    }
    for (const hero of reason.heroes) owners.add(hero)
    if (reason.verb === 'receives' || reason.verb === 'keeps') {
      if (reason.effect.giver === undefined) artifact = true
      else owners.add(reason.effect.giver)
    }
  }
  const tiles = why.units.filter(({ unit }) => owners.has(ruleUnit(unit))).map(({ tile }) => tile)
  return { tiles: new Set(tiles), artifact }
})

const units = computed(() =>
  board.units.map((unit) => ({
    ...thumbnailUnit(unit),
    highlight: named.value?.tiles.has(unit.hexId),
  })),
)

const artifact = computed(() => {
  const ally = thumbnailArtifact(board.artifacts.ally)
  return ally && { ...ally, highlight: named.value?.artifact }
})

const hint = computed(
  () =>
    !!shown.value?.alsoFine.length &&
    !shown.value.reasons.some((reason) => reason.verb === 'stands' && reason.place === 'free'),
)
</script>

<template>
  <BoardThumbnail
    class="sl-board"
    :map-key="board.mapKey"
    :tiles="board.tiles"
    :units
    :artifacts="{ ally: artifact }"
    :hex-size="18"
    crisp
    :outlined="shown?.alsoFine"
    @mouseover="onOver"
    @mouseout="hoverClose"
    @click="onClick"
    @touchstart.passive="onTouchStart"
  />
  <SlPlacementCard v-if="anchor && shown" :anchor :reasons="shown.reasons" :also-fine="hint" />
</template>

<style scoped>
.sl-board {
  width: 100%;
  height: auto;
}
</style>
