import { defineStore } from 'pinia'
import { computed } from 'vue'

import type { Grid, GridTile } from '../lib/grid'
import * as character from '../lib/character'
import { Team } from '../lib/types/team'
import { useGridStore } from './grid'
import { useSkillStore } from './skill'

export const useCharacterStore = defineStore('character', () => {
  const gridStore = useGridStore()
  const skillStore = useSkillStore()

  // Get references to domain objects - keep private for internal use
  const grid = gridStore._getGrid() as Grid
  const skillManager = skillStore._getSkillManager()

  // Consolidated character state - single computation point
  const characterState = computed(() => {
    const grid = gridStore._getGrid()
    return {
      count: grid.getCharacterCount(),
      placements: grid.getCharacterPlacements(),
      placedList: Array.from(grid.getCharacterPlacements().entries()),
      tilesWithCharacters: grid.getTilesWithCharacters(),
      availableAlly: grid.getAvailableForTeam(Team.ALLY),
      availableEnemy: grid.getAvailableForTeam(Team.ENEMY),
      maxTeamSizeAlly: grid.getMaxTeamSize(Team.ALLY),
      maxTeamSizeEnemy: grid.getMaxTeamSize(Team.ENEMY),
    }
  })

  // Individual getters that access consolidated state
  const charactersPlaced = computed(() => characterState.value.count)
  const placedCharactersList = computed(() => characterState.value.placedList)
  const characterPlacements = computed(() => characterState.value.placements)
  const availableAlly = computed(() => characterState.value.availableAlly)
  const availableEnemy = computed(() => characterState.value.availableEnemy)
  const maxTeamSizeAlly = computed(() => characterState.value.maxTeamSizeAlly)
  const maxTeamSizeEnemy = computed(() => characterState.value.maxTeamSizeEnemy)

  const getTilesWithCharacters = (): GridTile[] => {
    return characterState.value.tilesWithCharacters
  }

  // Character management actions - delegate to character manager
  const placeCharacterOnHex = (
    hexId: number,
    characterId: number,
    team: Team = Team.ALLY,
  ): boolean => character.placeCharacter(grid, skillManager, hexId, characterId, team)

  const removeCharacterFromHex = (hexId: number) =>
    character.removeCharacter(grid, skillManager, hexId)

  const clearAllCharacters = (): boolean => character.clearAllCharacters(grid, skillManager)

  const swapCharacters = (fromHexId: number, toHexId: number): boolean =>
    character.swapCharacters(grid, skillManager, fromHexId, toHexId)

  const moveCharacter = (fromHexId: number, toHexId: number, characterId: number): boolean =>
    character.moveCharacter(grid, skillManager, fromHexId, toHexId, characterId)

  const autoPlaceCharacter = (characterId: number, team: Team): boolean =>
    character.autoPlaceCharacter(grid, skillManager, characterId, team)

  const handleHexClick = (hex: import('../lib/hex').Hex): boolean =>
    character.handleHexClick(grid, skillManager, hex.getId())

  return {
    // Reactive state
    characterPlacements,
    charactersPlaced,
    placedCharactersList,
    availableAlly,
    availableEnemy,
    maxTeamSizeAlly,
    maxTeamSizeEnemy,

    // Actions (skill-integrated operations)
    placeCharacterOnHex,
    removeCharacterFromHex,
    clearAllCharacters,
    moveCharacter,
    swapCharacters,
    getTilesWithCharacters,
    autoPlaceCharacter,
    handleHexClick,
  }
})
