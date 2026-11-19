/* The units the Honor Duel pickers list: the shop's heroes, and under them
 * what only a Trial Card brings, a group per card. A creature is listed once
 * the data pack holds its picture.
 *
 * The tab lists a shop hero as its normal copy. The popup on an empty tile
 * lists it as `trial` says, a normal copy or a Trial one. No board holds that
 * value, so it outlives a rebuild of the boards and lasts while the page is
 * open; nothing stores it. */

import { computed, ref } from 'vue'

import { duelHeroes, duelTrialGroups, duelTrialHeroes } from '@/lib/hd/heroes'
import { useGameDataStore } from '@/stores/gameData'

const trial = ref(false)

export function useDuelUnits() {
  const gameData = useGameDataStore()
  const heroes = computed(() => duelHeroes(gameData.characters))
  const groups = computed(() =>
    duelTrialGroups([
      ...gameData.characters,
      ...gameData.creatures.filter((creature) => gameData.getCharacterImage(creature.name) !== ''),
    ]),
  )
  const grouped = computed(() => groups.value.flatMap((group) => group.units))
  // Every unit in the order the lists show them.
  const units = computed(() => [...heroes.value, ...grouped.value])
  const popupUnits = computed(() => [
    ...(trial.value ? duelTrialHeroes(gameData.characters) : heroes.value),
    ...grouped.value,
  ])
  return { trial, heroes, groups, units, popupUnits }
}
