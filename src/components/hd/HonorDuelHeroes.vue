<script setup lang="ts">
/* The Honor Duel board's units, the same for every player, so no roster
   narrows them: the shop's heroes, then what only a Trial Card brings, a group
   per card under a heading that says what its units are. The switch beside
   "Heroes" says what a hero's click places: a shop copy, which a second click
   takes off as on the Heroes tab, or a Trial copy. Every click on a Trial pick
   adds one more copy while a side has room. */

import { computed } from 'vue'

import CharacterFilterStrip from '@/components/CharacterFilterStrip.vue'
import CharacterGrid from '@/components/CharacterGrid.vue'
import CharacterIcon from '@/components/CharacterIcon.vue'
import DuelHeroSource from '@/components/hd/DuelHeroSource.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useDuelUnits } from '@/composables/useDuelUnits'
import { usePickerPlacement } from '@/composables/usePickerPlacement'
import { trialPickOf } from '@/lib/characters/trial'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { duelPickBackdrop } from '@/utils/tierBackdrop'

const grids = useGrids()
const i18n = useI18nStore()
const { targetTile, placedTeam, placeOnTarget, placeOnFirstSide } = usePickerPlacement()

const { heroes, groups, units: listed } = useDuelUnits()
const { factionFilter, classFilter, filteredCharacters } = useCharacterFilters(listed)

const HEROES = 'heroes'

// The factions of a group's heroes, in the order the group lists them.
const factionNames = (units: readonly CharacterType[]): string =>
  [...new Set(units.map((unit) => unit.faction))]
    .map((faction) => i18n.t(`game.${faction}`))
    .join(' / ')

interface UnitSection {
  key: string
  title: string
  units: CharacterType[]
}

const sections = computed(() => {
  const shown = new Set(filteredCharacters.value)
  const all: UnitSection[] = [
    { key: HEROES, title: i18n.t('app.heroes'), units: heroes.value },
    ...groups.value.map(({ card, creatures, units }) => ({
      key: card,
      title: creatures ? i18n.t('app.creatures') : factionNames(units),
      units,
    })),
  ]
  // The heroes' heading stays under a filter that leaves it no hero, since it
  // carries the switch.
  return all
    .map((section) => ({ ...section, units: section.units.filter((unit) => shown.has(unit)) }))
    .filter((section) => section.key === HEROES || section.units.length > 0)
})

const isTrialPick = (character: CharacterType): boolean => trialPickOf(character.id) !== null

// A targeted tile only places, so there a unit dims for that tile's side
// alone. Otherwise it dims once a click would no longer add it.
const isDimmed = (character: CharacterType): boolean => {
  const tile = targetTile.value
  if (tile) return grids.resolvePick(tile.ctx, character.id, tile.team, tile.hexId) === null
  if (!isTrialPick(character)) return placedTeam(character.id) !== null
  const ctx = grids.active
  return (
    !ctx ||
    [Team.ALLY, Team.ENEMY].every((team) => grids.resolvePick(ctx, character.id, team) === null)
  )
}

const handleClick = (character: CharacterType) => {
  if (placeOnTarget(character.id)) return
  // A Trial copy is taken off on the board itself, so its click only adds.
  const placed = isTrialPick(character) ? null : placedTeam(character.id)
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
    />

    <div class="icon-groups">
      <section v-for="section in sections" :key="section.key" class="icon-group">
        <div class="group-head">
          <h3 class="seasonal-title">{{ section.title }}</h3>
          <DuelHeroSource v-if="section.key === HEROES" />
        </div>
        <CharacterGrid v-if="section.units.length">
          <CharacterIcon
            v-for="character in section.units"
            :key="character.id"
            :character
            :backdrop="duelPickBackdrop(character)"
            is-draggable
            :dimmed="isDimmed(character)"
            inspectable
            show-outfit
            @character-click="handleClick"
          />
        </CharacterGrid>
      </section>
    </div>
  </section>
</template>

<style scoped>
.duel-heroes {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
}

.group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
</style>
