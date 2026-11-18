/* What each Trial Card brings, as the Honor Duel pickers list it: the heroes
 * with a hero file, and the creatures whose picture the data pack holds. */

import { computed, type ComputedRef } from 'vue'

import { duelTrialGroups, type TrialGroup } from '@/lib/hd/heroes'
import { useGameDataStore } from '@/stores/gameData'

export function useDuelTrialGroups(): ComputedRef<TrialGroup[]> {
  const gameData = useGameDataStore()
  return computed(() =>
    duelTrialGroups([
      ...gameData.characters,
      ...gameData.creatures.filter((creature) => gameData.getCharacterImage(creature.name) !== ''),
    ]),
  )
}
