<script setup lang="ts">
/* The Honor Duel board's off-field spots. A spot draws only while a hero holds
   it, as a faded second portrait of that hero, and all six of a side draw
   while one of its heroes picks a spot, so a board that uses none looks like
   one without them. The hero keeps its tile: the spot is a note that it
   leaves the field. */

import { computed, onMounted, onUnmounted, watchEffect } from 'vue'

import GridPointer from '@/components/grid/GridPointer.vue'
import { useArtifactPlaces } from '@/composables/useArtifactPlaces'
import { useGridContext } from '@/composables/useGridContext'
import { toBaseHeroId } from '@/lib/characters/character'
import { DUEL_ATTR_SPOT } from '@/lib/hd/board'
import { duelSpotHex, shownDuelSpots } from '@/lib/hd/spots'
import { Team } from '@/lib/types/team'
import { duelHeroUnits, setDuelSpot } from '@/stores/duelBoard'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

import '@/styles/grid-artifact.css'

const props = defineProps<{ readonly?: boolean }>()

const ctx = useGridContext()
const gameData = useGameDataStore()
const i18n = useI18nStore()
const places = useArtifactPlaces(ctx)

// A pick ends with its hero: one taken off the board picks nothing.
watchEffect(() => {
  const picked = ctx.duelSpotPick
  if (picked && !duelHeroUnits(ctx, picked.team).includes(picked.unitId)) ctx.setDuelSpotPick(null)
})

const pick = computed(() => (props.readonly ? null : ctx.duelSpotPick))

const holderView = (unitId: number) => {
  const name = gameData.getCharacterById(toBaseHeroId(unitId))?.name ?? ''
  return {
    unitId,
    image: gameData.getCharacterImage(name),
    label: `${localizedDisplayName(i18n.t, 'character', name)} · ${i18n.t('app.off-field')}`,
  }
}

const spots = computed(() =>
  [Team.ALLY, ...(places.enemyVisible.value ? [Team.ENEMY] : [])].flatMap((team) => {
    const holders = new Map<number, number>()
    for (const unitId of duelHeroUnits(ctx, team)) {
      const spot = ctx.getAttr(team, unitId, DUEL_ATTR_SPOT)
      if (spot) holders.set(spot, unitId)
    }
    const picking = pick.value?.team === team
    const front = team === Team.ALLY ? places.allyInFront.value : places.enemyInFront.value
    return shownDuelSpots(holders, picking).map((spot) => {
      const hex = duelSpotHex(ctx.grid, team, spot)
      const holder = holders.get(spot)
      return {
        key: `${team}:${spot}`,
        team,
        spot,
        front,
        picking,
        picked: picking && holder === pick.value?.unitId,
        points: ctx.layout.polygonPoints(hex),
        style: places.iconStyle(ctx.layout.hexToPixel(hex)),
        holder: holder === undefined ? null : holderView(holder),
      }
    })
  }),
)

// While a hero picks, a spot of its side takes it, and its own spot lets it
// go. Otherwise a held spot starts a pick for its hero.
const onSpot = (team: Team, spot: number, holder: number | undefined): void => {
  if (props.readonly) return
  const picked = pick.value
  if (picked?.team === team) {
    setDuelSpot(ctx, team, picked.unitId, holder === picked.unitId ? 0 : spot)
    ctx.setDuelSpotPick(null)
  } else if (holder !== undefined) {
    ctx.setDuelSpotPick({ team, unitId: holder })
  }
}

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') ctx.setDuelSpotPick(null)
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div v-if="spots.length" class="grid-artifacts">
    <svg
      class="artifact-cell-layer"
      :width="places.gridPixelSize.value"
      :height="places.gridPixelSize.value"
    >
      <polygon
        v-for="spot in spots"
        :key="spot.key"
        class="artifact-cell spot-cell"
        :class="{ clickable: spot.picking, picked: spot.picked }"
        :points="spot.points"
        @click="onSpot(spot.team, spot.spot, spot.holder?.unitId)"
      />
    </svg>
    <template v-for="spot in spots" :key="spot.key">
      <div
        v-if="spot.holder"
        class="grid-artifact"
        :class="{ readonly, front: spot.front }"
        :style="spot.style"
        :title="spot.holder.label"
        @click="onSpot(spot.team, spot.spot, spot.holder.unitId)"
      >
        <div class="artifact-circle">
          <img
            v-if="spot.holder.image"
            class="off-field"
            :src="spot.holder.image"
            :alt="spot.holder.label"
            draggable="false"
          />
        </div>
        <GridPointer v-if="ctx.perspective" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.spot-cell {
  stroke: var(--color-border-primary);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.spot-cell.picked {
  stroke: var(--color-primary);
  stroke-dasharray: none;
  stroke-width: 2;
}

.off-field {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.45;
}
</style>
