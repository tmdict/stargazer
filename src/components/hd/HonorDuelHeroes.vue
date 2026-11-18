<script setup lang="ts">
/* The Honor Duel board's pickers: its map on screens too narrow for the map
   menu, and the mode's units in two lists, the same for every player, so no
   roster narrows them. In the Shop list a click places a hero and a second
   takes it off, as on the Heroes tab. The Trial list holds what each Trial
   Card brings, a group per card, and there every click adds one more copy at
   the card's tier while a side has room. */

import { computed, watch } from 'vue'

import CharacterFilterStrip from '@/components/CharacterFilterStrip.vue'
import CharacterGrid from '@/components/CharacterGrid.vue'
import CharacterIcon from '@/components/CharacterIcon.vue'
import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useDuelTrialGroups } from '@/composables/useDuelTrialGroups'
import { usePickerPlacement } from '@/composables/usePickerPlacement'
import { duelHeroes, trialCardName } from '@/lib/hd/heroes'
import { DUEL_MAP_NAMES } from '@/lib/hd/maps'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useDuelBoard } from '@/stores/duelBoard'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const grids = useGrids()
const gameData = useGameDataStore()
const i18n = useI18nStore()
const duelBoard = useDuelBoard()
const { targetTile, placedTeam, placeOnTarget, placeOnFirstSide } = usePickerPlacement()

const shopHeroes = computed(() => duelHeroes(gameData.characters))
const trialGroups = useDuelTrialGroups()
const listed = computed(() =>
  grids.trial ? trialGroups.value.flatMap((group) => group.units) : shopHeroes.value,
)
const { factionFilter, classFilter, filteredCharacters } = useCharacterFilters(listed)

const shownGroups = computed(() => {
  const shown = new Set(filteredCharacters.value)
  return trialGroups.value
    .map(({ card, units }) => ({ card, units: units.filter((unit) => shown.has(unit)) }))
    .filter((group) => group.units.length > 0)
})

// A filter the list on show has no option for would empty it with nothing lit
// to clear.
watch(listed, (units) => {
  if (!units.some((unit) => unit.faction === factionFilter.value)) factionFilter.value = ''
  if (!units.some((unit) => unit.class === classFilter.value)) classFilter.value = ''
})

const lists = computed(() => [
  { key: 'shop', label: i18n.t('app.shop'), selected: !grids.trial },
  { key: 'trial', label: i18n.t('app.trial'), selected: grids.trial },
])

const maps = computed(() =>
  DUEL_MAP_NAMES.map(({ key, name }) => ({
    key,
    label: name,
    selected: grids.active?.currentMap === key,
  })),
)

// A targeted tile only places, so there a unit dims for that tile's side
// alone. Otherwise it dims once a click would no longer add it.
const isDimmed = (character: CharacterType): boolean => {
  const tile = targetTile.value
  if (tile) return grids.resolvePick(tile.ctx, character.id, tile.team, tile.hexId) === null
  if (!grids.trial) return placedTeam(character.id) !== null
  const ctx = grids.active
  return (
    !ctx ||
    [Team.ALLY, Team.ENEMY].every((team) => grids.resolvePick(ctx, character.id, team) === null)
  )
}

const handleClick = (character: CharacterType) => {
  if (placeOnTarget(character.id)) return
  // A Trial copy is taken off on the board itself, so its click only adds.
  const placed = grids.trial ? null : placedTeam(character.id)
  if (placed !== null) grids.removeFromAnyBoard(character.id, placed)
  else placeOnFirstSide(character.id)
}
</script>

<template>
  <section class="duel-heroes">
    <CharacterFilterStrip
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      :characters="listed"
    >
      <template #menus>
        <SegmentedPicker
          small
          :segments="lists"
          :aria-label="i18n.t('app.heroes')"
          @select="grids.trial = $event === 'trial'"
        />
        <SegmentedPicker
          small
          class="duel-maps"
          :segments="maps"
          :aria-label="i18n.t('app.maps')"
          @select="duelBoard.moveToMap($event)"
        />
      </template>
    </CharacterFilterStrip>

    <div v-if="grids.trial" class="icon-groups">
      <section v-for="group in shownGroups" :key="group.card" class="icon-group">
        <h3 class="seasonal-title">{{ trialCardName(group.card, i18n.currentLocale) }}</h3>
        <CharacterGrid>
          <CharacterIcon
            v-for="character in group.units"
            :key="character.id"
            :character
            is-draggable
            :dimmed="isDimmed(character)"
            inspectable
            show-outfit
            @character-click="handleClick"
          />
        </CharacterGrid>
      </section>
    </div>
    <CharacterGrid v-else>
      <CharacterIcon
        v-for="character in filteredCharacters"
        :key="character.id"
        :character
        is-draggable
        :dimmed="isDimmed(character)"
        inspectable
        show-outfit
        @character-click="handleClick"
      />
    </CharacterGrid>
  </section>
</template>

<style scoped>
.duel-heroes {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
}

@media (min-width: 1320px) {
  .duel-maps {
    display: none;
  }
}

@media (max-width: 768px) {
  .duel-heroes {
    --filter-inset: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .duel-heroes {
    --filter-inset: var(--spacing-sm);
  }
}
</style>
