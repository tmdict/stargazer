/* The units the Honor Duel pickers list: the shop's heroes, and under them
 * what only a Trial Card brings, a group per card. A creature is listed once
 * the data pack holds its picture.
 *
 * `trial` says whether a shop hero is picked as a Trial copy. It is one value
 * for the tab's list and the popup on an empty tile, so they never disagree.
 * No board holds it, so it outlives a rebuild of the boards and lasts while
 * the page is open; nothing stores it. */

import { computed, ref } from 'vue'

import { duelHeroes, duelTrialGroups, duelTrialHeroes } from '@/lib/hd/heroes'
import { useGameDataStore } from '@/stores/gameData'

const trial = ref(false)

export function useDuelUnits() {
  const gameData = useGameDataStore()
  const heroes = computed(() =>
    trial.value ? duelTrialHeroes(gameData.characters) : duelHeroes(gameData.characters),
  )
  const groups = computed(() =>
    duelTrialGroups([
      ...gameData.characters,
      ...gameData.creatures.filter((creature) => gameData.getCharacterImage(creature.name) !== ''),
    ]),
  )
  // Every unit in the order the lists show them.
  const units = computed(() => [...heroes.value, ...groups.value.flatMap((group) => group.units)])
  return { trial, heroes, groups, units }
}
