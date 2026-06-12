import { computed, watch } from 'vue'
import { defineStore } from 'pinia'

import {
  canPlaceCharacterOnTeam,
  findTeamPhantimalHex,
  getCharacter,
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
import {
  countTeamFaction,
  PHANTIMAL_FACTION_REQUIREMENT,
  requiredFactions,
} from '@/lib/characters/phantimalFaction'
import { executeAutoPlaceCharacter, executePlaceCharacter } from '@/lib/characters/place'
import { executeClearAllCharacters, executeRemoveCharacter } from '@/lib/characters/remove'
import { executeSwapCharacters } from '@/lib/characters/swap'
import type { GridTile } from '@/lib/grid'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'
import { useGameDataStore } from './gameData'
import { useGridStore } from './grid'
import { useSkillStore } from './skill'

export const useCharacterStore = defineStore('character', () => {
  const gridStore = useGridStore()
  const skillStore = useSkillStore()
  const gameDataStore = useGameDataStore()

  // Internal domain refs via the stores' private _ accessors; not re-exposed.
  const grid = gridStore._getGrid()
  const skillManager = skillStore._getSkillManager()

  const charactersPlaced = computed(() => {
    return getCharacterCount(grid)
  })

  const characterPlacements = computed(() => {
    return getCharacterPlacements(grid)
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

  // Count of a phantimal's faction (both factions for midnight-hunter) on a team.
  const phantimalFactionCount = (phantimalId: number, team: Team): number => {
    const phantimal = gameDataStore.getPhantimalById(phantimalId)
    if (!phantimal) return 0
    const factions = requiredFactions(phantimal.name, phantimal.faction)
    return countTeamFaction(grid, team, factions, gameDataStore.getCharacterFaction)
  }

  // A phantimal may only join a team that fields enough of its faction.
  // When phantimal data isn't loaded (e.g. unit tests) the rule can't be evaluated
  // and placement is allowed.
  const phantimalCanJoinTeam = (phantimalId: number, team: Team): boolean => {
    const phantimal = gameDataStore.getPhantimalById(phantimalId)
    if (!phantimal) return true
    const factions = requiredFactions(phantimal.name, phantimal.faction)
    const count = countTeamFaction(grid, team, factions, gameDataStore.getCharacterFaction)
    return count >= PHANTIMAL_FACTION_REQUIREMENT
  }

  const placePhantimalOnHex = (
    hexId: number,
    phantimalId: number,
    team: Team = Team.ALLY,
  ): boolean => {
    if (!phantimalCanJoinTeam(phantimalId, team)) return false
    clearTeamPhantimal(team, hexId)
    return executePlaceCharacter(grid, skillManager, hexId, phantimalId, team)
  }

  const autoPlacePhantimal = (phantimalId: number, team: Team): boolean => {
    if (!phantimalCanJoinTeam(phantimalId, team)) return false
    clearTeamPhantimal(team)
    return executeAutoPlaceCharacter(grid, skillManager, phantimalId, team)
  }

  // Remove any on-field phantimal whose team no longer meets its faction
  // requirement (e.g. a faction character was removed/moved off the team).
  let enforcing = false
  const enforcePhantimalFactionRule = (): void => {
    if (enforcing) return
    enforcing = true
    try {
      for (const team of [Team.ALLY, Team.ENEMY]) {
        const hexId = findTeamPhantimalHex(grid, team)
        if (hexId === null) continue
        const phantimalId = getCharacter(grid, hexId)
        if (phantimalId !== undefined && !phantimalCanJoinTeam(phantimalId, team)) {
          executeRemoveCharacter(grid, skillManager, hexId)
        }
      }
    } finally {
      enforcing = false
    }
  }

  // Any change to placements can shift a team's faction count; re-check after each.
  watch(characterPlacements, enforcePhantimalFactionRule, { flush: 'post' })

  // Dispatch a drop payload to the right placement primitive.
  // Grid-source drops swap-or-move; selection drops validate team capacity then place.
  const handleCharacterDrop = (
    payload: { character: CharacterType; characterId: number },
    targetHexId: number,
  ): boolean => {
    const { character, characterId } = payload
    if (character.sourceHexId !== undefined) {
      // Cross-team phantimal/companion swaps are rejected inside executeSwapCharacters
      if (hasCharacter(grid, targetHexId)) {
        return swapCharacters(character.sourceHexId, targetHexId)
      }
      // Moving a phantimal onto an empty cell on the other team must preserve the
      // one-per-team rule (a swap already does, since it exchanges occupants) and
      // the destination team's faction requirement.
      if (isPhantimalId(characterId)) {
        const destTeam = getTeamFromTileState(gridStore.getTile(targetHexId).state)
        const sourceTeam = getCharacterTeam(grid, character.sourceHexId)
        if (destTeam !== null && destTeam !== sourceTeam) {
          if (!phantimalCanJoinTeam(characterId, destTeam)) return false
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

  return {
    // Reactive state
    characterPlacements,
    charactersPlaced,
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
    phantimalCanJoinTeam,
    phantimalFactionCount,
    handleCharacterDrop,
  }
})
