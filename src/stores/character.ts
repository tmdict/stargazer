import { computed } from 'vue'
import { defineStore } from 'pinia'

import {
  canPlaceCharacterOnTeam,
  findTeamPhantimalHex,
  getCharacterCount,
  getCharacterPlacements,
  getCharacterTeam,
  getMaxTeamSize,
  getTeamCharacters,
  getTilesWithCharacters,
  hasCharacter,
} from '@/lib/characters/character'
import { executeMoveCharacter } from '@/lib/characters/move'
import { isPhantimalId } from '@/lib/characters/phantimal'
import { executeAutoPlaceCharacter, executePlaceCharacter } from '@/lib/characters/place'
import { executeClearAllCharacters, executeRemoveCharacter } from '@/lib/characters/remove'
import { executeSwapCharacters } from '@/lib/characters/swap'
import type { GridTile } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'
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

  // Phantimals are capped at one per team: clear the team's current phantimal
  // (unless it's the one we're about to (re)place) before adding a new one.
  const clearTeamPhantimal = (team: Team, exceptHexId?: number): void => {
    const existing = findTeamPhantimalHex(grid, team)
    if (existing !== null && existing !== exceptHexId) {
      executeRemoveCharacter(grid, skillManager, existing)
    }
  }

  const placePhantimalOnHex = (
    hexId: number,
    phantimalId: number,
    team: Team = Team.ALLY,
  ): boolean => {
    clearTeamPhantimal(team, hexId)
    return executePlaceCharacter(grid, skillManager, hexId, phantimalId, team)
  }

  const autoPlacePhantimal = (phantimalId: number, team: Team): boolean => {
    clearTeamPhantimal(team)
    return executeAutoPlaceCharacter(grid, skillManager, phantimalId, team)
  }

  // Dispatch a drop payload to the right placement primitive.
  // Grid-source drops swap-or-move; selection drops validate team capacity then place.
  const handleCharacterDrop = (
    payload: { character: CharacterType; characterId: number },
    targetHexId: number,
  ): boolean => {
    const { character, characterId } = payload
    if (character.sourceHexId !== undefined) {
      if (hasCharacter(grid, targetHexId)) {
        return swapCharacters(character.sourceHexId, targetHexId)
      }
      // Moving a phantimal onto an empty cell on the other team must preserve the
      // one-per-team rule (a swap already does, since it exchanges occupants).
      if (isPhantimalId(characterId)) {
        const destTeam = getTeamFromTileState(gridStore.getTile(targetHexId).state)
        const sourceTeam = getCharacterTeam(grid, character.sourceHexId)
        if (destTeam !== null && destTeam !== sourceTeam) {
          clearTeamPhantimal(destTeam, character.sourceHexId)
        }
      }
      return moveCharacter(character.sourceHexId, targetHexId, characterId)
    }
    const team = getTeamFromTileState(gridStore.getTile(targetHexId).state)
    if (team === null) return false
    if (isPhantimalId(characterId)) {
      return placePhantimalOnHex(targetHexId, characterId, team)
    }
    if (!canPlaceCharacterOnTeam(grid, characterId, team)) return false
    return placeCharacterOnHex(targetHexId, characterId, team)
  }

  const handleHexClick = (hex: Hex): boolean => {
    // Desktop only: clicking an occupied tile removes its hero. On mobile, tile
    // taps are handled by GridManager (lift/move/target) and the character
    // overlay (remove); auto-removing here would undo a just-completed move.
    if (gridStore.getHexScale() < 1) return false
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
    placePhantimalOnHex,
    autoPlacePhantimal,
    handleHexClick,
    handleCharacterDrop,
  }
})
