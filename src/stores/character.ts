/* Single-board character actions over the active grid context.
 *
 * Adapts the active board in useGrids to the character API the Arena roster and
 * grid components consume. Placement logic and the phantimal faction guardrail
 * live on the context (per board); this store forwards to the active one.
 */

import { computed } from 'vue'
import { defineStore } from 'pinia'

import { getTilesWithCharacters } from '@/lib/characters/character'
import type { GridTile } from '@/lib/grid'
import { Team } from '@/lib/types/team'
import { useGrids } from './grids'

export const useCharacterStore = defineStore('character', () => {
  const grids = useGrids()
  const active = () => grids.active!

  const charactersPlaced = computed(() => active().charactersPlaced)

  const placeCharacterOnHex = (
    hexId: number,
    characterId: number,
    team: Team = Team.ALLY,
  ): boolean => active().place(hexId, characterId, team)

  const removeCharacterFromHex = (hexId: number): boolean => active().remove(hexId)

  const clearAllCharacters = (): void => active().clearCharacters()

  const moveCharacter = (fromHexId: number, toHexId: number, characterId: number): boolean =>
    active().move(fromHexId, toHexId, characterId)

  const placePhantimalOnHex = (
    hexId: number,
    phantimalId: number,
    team: Team = Team.ALLY,
  ): boolean => active().placePhantimal(hexId, phantimalId, team)

  const autoPlacePhantimal = (phantimalId: number, team: Team): boolean =>
    active().autoPlacePhantimal(phantimalId, team)

  const phantimalFactionCount = (phantimalId: number, team: Team): number =>
    active().phantimalFactionCount(phantimalId, team)

  const seedPhantimalBaseline = (): void => active().seedPhantimalBaseline()

  const getTilesWithCharactersStore = (): GridTile[] => getTilesWithCharacters(active().grid)

  return {
    charactersPlaced,
    placeCharacterOnHex,
    removeCharacterFromHex,
    clearAllCharacters,
    moveCharacter,
    getTilesWithCharacters: getTilesWithCharactersStore,
    placePhantimalOnHex,
    autoPlacePhantimal,
    phantimalFactionCount,
    seedPhantimalBaseline,
  }
})
