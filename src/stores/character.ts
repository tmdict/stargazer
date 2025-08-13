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

  const charactersPlaced = computed(() => {
    return grid.getCharacterCount()
  })

  const characterPlacements = computed(() => {
    return grid.getCharacterPlacements()
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
  const getTilesWithCharacters = (): GridTile[] => {
    return grid.getTilesWithCharacters()
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
