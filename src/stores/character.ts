import { computed } from 'vue'
import { defineStore } from 'pinia'

import {
  getCharacterCount,
  getCharacterPlacements,
  getTilesWithCharacters,
  hasCharacter,
} from '../lib/character'
import type { GridTile } from '../lib/grid'
import type { Hex } from '../lib/hex'
import { executeMoveCharacter } from '../lib/transactions/move'
import { executeAutoPlaceCharacter, executePlaceCharacter } from '../lib/transactions/place'
import { executeClearAllCharacters, executeRemoveCharacter } from '../lib/transactions/remove'
import { executeSwapCharacters } from '../lib/transactions/swap'
import { Team } from '../lib/types/team'
import { useGridStore } from './grid'
import { useSkillStore } from './skill'

export const useCharacterStore = defineStore('character', () => {
  const gridStore = useGridStore()
  const skillStore = useSkillStore()

  // Get references to domain objects - keep private for internal use
  const grid = gridStore._getGrid()
  const skillManager = skillStore._getSkillManager()

  const charactersPlaced = computed(() => {
    return getCharacterCount(grid)
  })

  const characterPlacements = computed(() => {
    return getCharacterPlacements(grid)
  })

  const placedCharactersList = computed(() => {
    return Array.from(characterPlacements.value.entries())
  })

  // Separate computed for team counts to avoid full traversal
  const teamCharacterCounts = computed(() => {
    const allyCount = grid.getTeamCharacters(Team.ALLY).size
    const enemyCount = grid.getTeamCharacters(Team.ENEMY).size
    return { ally: allyCount, enemy: enemyCount }
  })

  const availableAlly = computed(() => {
    return grid.getMaxTeamSize(Team.ALLY) - teamCharacterCounts.value.ally
  })

  const availableEnemy = computed(() => {
    return grid.getMaxTeamSize(Team.ENEMY) - teamCharacterCounts.value.enemy
  })

  const maxTeamSizeAlly = computed(() => grid.getMaxTeamSize(Team.ALLY))
  const maxTeamSizeEnemy = computed(() => grid.getMaxTeamSize(Team.ENEMY))

  // This one stays as a function since it's rarely called
  const getTilesWithCharactersStore = (): GridTile[] => {
    return getTilesWithCharacters(grid)
  }

  // Character management actions - delegate to character manager
  const placeCharacterOnHex = (
    hexId: number,
    characterId: number,
    team: Team = Team.ALLY,
  ): boolean => executePlaceCharacter(grid, skillManager, hexId, characterId, team)

  const removeCharacterFromHex = (hexId: number): boolean =>
    executeRemoveCharacter(grid, skillManager, hexId)

  const clearAllCharacters = (): boolean => executeClearAllCharacters(grid, skillManager)

  const swapCharacters = (fromHexId: number, toHexId: number): boolean =>
    executeSwapCharacters(grid, skillManager, fromHexId, toHexId)

  const moveCharacter = (fromHexId: number, toHexId: number, characterId: number): boolean =>
    executeMoveCharacter(grid, skillManager, fromHexId, toHexId, characterId)

  const autoPlaceCharacter = (characterId: number, team: Team): boolean =>
    executeAutoPlaceCharacter(grid, skillManager, characterId, team)

  const handleHexClick = (hex: Hex): boolean => {
    const hexId = hex.getId()
    if (hasCharacter(grid, hexId)) {
      return executeRemoveCharacter(grid, skillManager, hexId)
    }
    return false
  }

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
    getTilesWithCharacters: getTilesWithCharactersStore,
    autoPlaceCharacter,
    handleHexClick,
  }
})
