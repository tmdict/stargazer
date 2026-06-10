import type { Grid } from '../grid'
import { hasCompanionSkill, hasSkill, SkillManager } from '../skills/skill'
import { State } from '../types/state'
import { Team } from '../types/team'
import {
  canPlaceCharacterOnTeam,
  canPlaceCharacterOnTile,
  findCharacterHex,
  getAllAvailableTilesForTeam,
  getCharacter,
  getCharacterTeam,
  getTeamCharacters,
  hasCharacter,
} from './character'
import {
  getMainCharacterId,
  isCompanionId,
  restoreCompanions,
  storeCompanionPositions,
} from './companion'
import { isPhantimalId } from './phantimal'
import { performRemove } from './remove'
import { executeTransaction } from './transaction'

// High-level operations

export function executePlaceCharacter(
  grid: Grid,
  skillManager: SkillManager,
  hexId: number,
  characterId: number,
  team: Team = Team.ALLY,
): boolean {
  // Companions cannot be placed directly (only created via skills)
  if (isCompanionId(grid, characterId)) {
    return false
  }

  // Placing onto an occupied tile replaces the occupant, with full skill
  // cleanup. The unit to remove is anchored on the main character: a companion
  // occupant cascades to its main (removing either removes the whole unit,
  // matching executeRemoveCharacter's semantics).
  const occupantId = getCharacter(grid, hexId)
  const occupantTeam = getCharacterTeam(grid, hexId)
  let anchorId = occupantId
  let anchorHex = hexId
  if (occupantId !== undefined && occupantTeam !== undefined && isCompanionId(grid, occupantId)) {
    const mainCharId = getMainCharacterId(grid, occupantId)
    const mainHexId = findCharacterHex(grid, mainCharId, occupantTeam)
    if (mainHexId !== null) {
      anchorId = mainCharId
      anchorHex = mainHexId
    }
  }

  let occupantCompanions: ReturnType<typeof storeCompanionPositions> = []
  let occupantSkillDeactivated = false
  let occupantRemoved = false
  let placed = false

  const result = executeTransaction(
    [
      // Step 1: Clear the occupant (if any) with full skill cleanup
      () => {
        if (anchorId === undefined || occupantTeam === undefined) return true
        occupantCompanions = storeCompanionPositions(grid, anchorId, occupantTeam)
        if (skillManager.hasActiveSkill(anchorId, occupantTeam)) {
          skillManager.deactivateCharacterSkill(anchorId, anchorHex, occupantTeam, grid)
          occupantSkillDeactivated = true
        }
        if (hasCharacter(grid, anchorHex)) {
          occupantRemoved = performRemove(grid, anchorHex)
          if (!occupantRemoved) return false
        }
        // The target tile must be free now (a companion occupant is removed
        // by its main's skill deactivation)
        return !hasCharacter(grid, hexId)
      },
      // Step 2: Place character
      () => {
        placed = performPlace(grid, hexId, characterId, team)
        return placed
      },
      // Step 3: Activate skill if character has one
      () => {
        if (!hasSkill(characterId)) return true
        return skillManager.activateCharacterSkill(characterId, hexId, team, grid)
      },
    ],
    [
      // Rollback: remove the new character first, then restore the occupant —
      // re-place, re-activate its skill, and return companions to their tiles
      () => {
        if (placed && hasCharacter(grid, hexId)) {
          if (!performRemove(grid, hexId)) {
            console.warn(`Failed to rollback character placement at hex ${hexId}`)
          }
        }
        if (anchorId === undefined || occupantTeam === undefined) return
        if (occupantRemoved) {
          performPlace(grid, anchorHex, anchorId, occupantTeam)
        }
        if (occupantSkillDeactivated) {
          skillManager.activateCharacterSkill(anchorId, anchorHex, occupantTeam, grid)
          if (hasCompanionSkill(anchorId)) {
            restoreCompanions(grid, skillManager, anchorId, occupantCompanions)
          }
        }
      },
    ],
  )

  // Trigger skill updates after successful transaction
  if (result && grid.skillManager) {
    grid.skillManager.updateActiveSkills(grid)
  }

  return result
}

export function executeAutoPlaceCharacter(
  grid: Grid,
  skillManager: SkillManager,
  characterId: number,
  team: Team,
): boolean {
  // Validate character can be placed
  if (!canPlaceCharacterOnTeam(grid, characterId, team)) return false

  // Get all available tiles for this team
  const availableTiles = getAllAvailableTilesForTeam(grid, team)
  if (availableTiles.length == 0) return false

  // Sort by hex ID descending (largest first) for deterministic randomness
  availableTiles.sort((a, b) => b.hex.getId() - a.hex.getId())

  // Select random tile from available options
  const randomIndex = Math.floor(Math.random() * availableTiles.length)
  const selectedTile = availableTiles[randomIndex]

  if (!selectedTile) {
    console.error(
      'executeAutoPlaceCharacter: Selected tile is undefined despite non-empty availableTiles array',
      {
        randomIndex,
        availableTilesLength: availableTiles.length,
      },
    )
    return false
  }

  const hexId = selectedTile.hex.getId()

  // Place character
  const placed = performPlace(grid, hexId, characterId, team)
  if (!placed) return false

  // Activate skill if character has one
  if (hasSkill(characterId)) {
    const activated = skillManager.activateCharacterSkill(characterId, hexId, team, grid)

    if (!activated) {
      // Clean up on skill failure
      if (!performRemove(grid, hexId)) {
        console.warn(
          `Failed to remove character ${characterId} from hex ${hexId} after skill activation failure`,
        )
      }
      return false
    }
  }

  // Trigger skill updates after successful placement
  if (grid.skillManager) {
    grid.skillManager.updateActiveSkills(grid)
  }

  return true
}

// Atomic operations

// Performs atomic character placement
export function performPlace(
  grid: Grid,
  hexId: number,
  characterId: number,
  team: Team = Team.ALLY,
): boolean {
  // Input validation
  if (!Number.isInteger(characterId) || characterId <= 0) return false

  if (!canPlaceCharacterOnTile(grid, hexId, team)) return false
  if (!canPlaceCharacterOnTeam(grid, characterId, team)) return false

  const tile = grid.getTileById(hexId)

  // The atomic primitive never displaces an existing unit: replacement is the
  // skill-aware composite in executePlaceCharacter, swaps clear both tiles first
  if (tile.characterId) return false

  // Set character on tile (merged from setCharacterOnTile)
  tile.characterId = characterId
  tile.team = team
  tile.state = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY
  // Phantimals occupy the tile but are exempt from team-size tracking.
  if (!isPhantimalId(characterId)) {
    getTeamCharacters(grid, team).add(characterId)
  }

  return true
}
