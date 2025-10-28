import { computed } from 'vue'
import { defineStore } from 'pinia'

import {
  getCharacterCount,
  getCharacterPlacements,
  getMaxTeamSize,
  getTeamCharacters,
  getTilesWithCharacters,
  hasCharacter,
} from '@/lib/characters/character'
import { executeMoveCharacter } from '@/lib/characters/move'
import { executeAutoPlaceCharacter, executePlaceCharacter } from '@/lib/characters/place'
import { executeClearAllCharacters, executeRemoveCharacter } from '@/lib/characters/remove'
import { executeSwapCharacters } from '@/lib/characters/swap'
import type { GridTile } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import { Team } from '@/lib/types/team'
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
    const allyCount = getTeamCharacters(grid, Team.ALLY).size
    const enemyCount = getTeamCharacters(grid, Team.ENEMY).size
    return { ally: allyCount, enemy: enemyCount }
  })

  const availableAlly = computed(() => {
    return getMaxTeamSize(grid, Team.ALLY) - teamCharacterCounts.value.ally
  })

  const availableEnemy = computed(() => {
    return getMaxTeamSize(grid, Team.ENEMY) - teamCharacterCounts.value.enemy
  })

  const maxTeamSizeAlly = computed(() => getMaxTeamSize(grid, Team.ALLY))
  const maxTeamSizeEnemy = computed(() => getMaxTeamSize(grid, Team.ENEMY))

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
