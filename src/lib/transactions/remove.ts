import {
  clearCharacterFromTile,
  findCharacterHex,
  getCharacter,
  getCharacterTeam,
  getTilesWithCharacters,
  hasCharacter,
  removeCharacterFromTeam,
} from '../character'
import type { Grid } from '../grid'
import { hasSkill, SkillManager } from '../skill'
import { Team } from '../types/team'
import { performPlace } from './place'
import { executeTransaction, handleCacheInvalidation } from './transaction'

// High-level operations

export function executeRemoveCharacter(
  grid: Grid,
  skillManager: SkillManager,
  hexId: number,
): boolean {
  const characterId = getCharacter(grid, hexId)
  const team = getCharacterTeam(grid, hexId)

  if (!characterId || !team) return true

  // Check if this is a companion - if so, we need to remove both companion and main character
  if (grid.isCompanionId(characterId)) {
    const mainCharId = grid.getMainCharacterId(characterId)

    // Find the main character's hex on the same team as the companion
    const mainHexId = findCharacterHex(grid, mainCharId, team)

    if (mainHexId !== null) {
      // Remove the main character, which will trigger skill deactivation and remove the companion
      return executeRemoveCharacter(grid, skillManager, mainHexId)
    } else {
      // Main character not found, just remove the companion directly
      return performRemove(grid, hexId, true)
    }
  }

  // Regular character removal
  // Since removal should always succeed, we don't need a transaction here
  // Just execute operations in order

  // Deactivate skill first (may remove companions)
  if (hasSkill(characterId)) {
    skillManager.deactivateCharacterSkill(characterId, hexId, team, grid)
  }

  // Remove character(s) - skill may have already removed them
  let removed = true
  if (hasCharacter(grid, hexId)) {
    removed = performRemove(grid, hexId, true)
  }

  // Update all active skills to recalculate targets after removal
  skillManager.updateActiveSkills(grid)

  return removed
}

export function executeClearAllCharacters(grid: Grid, skillManager: SkillManager): boolean {
  // Deactivate all skills first
  skillManager.deactivateAllSkills(grid)

  // Clear all characters
  return performClearAll(grid)
}

// Atomic operations

// Performs atomic character removal
export function performRemove(
  grid: Grid,
  hexId: number,
  skipCacheInvalidation: boolean = false,
): boolean {
  const tile = grid.getTileById(hexId)
  if (tile.characterId) {
    if (!tile.team) {
      console.error(`Tile at hex ${hexId} has characterId ${tile.characterId} but no team`)
      return false
    }
    const characterId = tile.characterId
    const team = tile.team

    // Remove character from team tracking
    removeCharacterFromTeam(grid, characterId, team)
    // Clear character from tile
    clearCharacterFromTile(tile)

    // Handle cache invalidation with batching support
    handleCacheInvalidation(skipCacheInvalidation, grid.skillManager, grid)
    return true
  }
  return false
}

// Performs atomic clear of all characters
export function performClearAll(grid: Grid): boolean {
  // Collect all current placements for potential rollback
  const currentPlacements = getTilesWithCharacters(grid).map((tile) => ({
    hexId: tile.hex.getId(),
    characterId: tile.characterId!,
    team: tile.team!,
  }))

  // If no characters to clear, return success immediately
  if (currentPlacements.length === 0) {
    handleCacheInvalidation(false, grid.skillManager, grid)
    return true
  }

  // Use transaction pattern for atomic clear operation
  const result = executeTransaction(
    // Operations to execute
    [
      () => {
        // Clear all character data
        for (const tile of grid.getAllTiles()) {
          if (tile.characterId) {
            clearCharacterFromTile(tile)
          }
        }
        grid.getTeamCharacters(Team.ALLY).clear()
        grid.getTeamCharacters(Team.ENEMY).clear()
        return true
      },
    ],
    // Rollback operations - restore all characters
    [
      () => {
        currentPlacements.forEach((placement) => {
          performPlace(grid, placement.hexId, placement.characterId, placement.team, true)
        })
      },
    ],
  )

  // Trigger skill updates after successful transaction
  if (result && grid.skillManager) {
    grid.skillManager.updateActiveSkills(grid)
  }

  return result
}
