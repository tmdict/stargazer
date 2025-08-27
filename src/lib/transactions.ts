import type { Grid } from './grid'
import { getCharacterSkill, hasCompanionSkill, hasSkill, SkillManager } from './skill'
import { executeTransaction } from './transaction'
import { State } from './types/state'
import { Team } from './types/team'

/**
 * Complex character operations with skill integration
 * All functions handle atomic operations with transactions
 */

export function executePlaceCharacter(
  grid: Grid,
  skillManager: SkillManager,
  hexId: number,
  characterId: number,
  team: Team = Team.ALLY,
): boolean {
  // Companions cannot be placed directly (only created via skills)
  if (grid.isCompanionId(characterId)) {
    return false
  }

  let placed = false

  const result = executeTransaction(
    [
      // Place character
      () => {
        placed = grid.placeCharacter(hexId, characterId, team, true)
        return placed
      },
      // Activate skill if character has one
      () => {
        if (!hasSkill(characterId)) return true
        return skillManager.activateCharacterSkill(characterId, hexId, team, grid)
      },
    ],
    [
      // Rollback: remove character if it was placed
      () => {
        if (placed && grid.hasCharacter(hexId)) {
          if (!grid.removeCharacter(hexId, true)) {
            console.warn(`Failed to rollback character placement at hex ${hexId}`)
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

export function executeRemoveCharacter(
  grid: Grid,
  skillManager: SkillManager,
  hexId: number,
): boolean {
  const characterId = grid.getCharacter(hexId)
  const team = grid.getCharacterTeam(hexId)

  if (!characterId || !team) return true

  // Check if this is a companion - if so, we need to remove both companion and main character
  if (grid.isCompanionId(characterId)) {
    const mainCharId = grid.getMainCharacterId(characterId)

    // Find the main character's hex on the same team as the companion
    const mainHexId = grid.findCharacterHex(mainCharId, team)

    if (mainHexId !== null) {
      // Remove the main character, which will trigger skill deactivation and remove the companion
      return executeRemoveCharacter(grid, skillManager, mainHexId)
    } else {
      // Main character not found, just remove the companion directly
      return grid.removeCharacter(hexId, true)
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
  if (grid.hasCharacter(hexId)) {
    removed = grid.removeCharacter(hexId, true)
  }

  // Update all active skills to recalculate targets after removal
  skillManager.updateActiveSkills(grid)

  return removed
}

export function executeClearAllCharacters(grid: Grid, skillManager: SkillManager): boolean {
  // Deactivate all skills first
  skillManager.deactivateAllSkills(grid)

  // Clear all characters (uses existing transaction internally)
  return grid.clearAllCharacters()
}

// Helper type for companion position tracking
interface CompanionPosition {
  companionId: number
  hexId: number
  team: Team
  mainCharId: number
}

// Helper to check if cross-team swap would create duplicate characters
function wouldCreateDuplicate(
  grid: Grid,
  fromChar: number,
  toChar: number,
  fromTeam: Team,
  toTeam: Team,
): boolean {
  const fromTeamChars = grid.getTeamCharacters(fromTeam)
  const toTeamChars = grid.getTeamCharacters(toTeam)

  // Check if placing fromChar on toTeam would violate duplicate constraint
  if (toTeamChars.has(fromChar)) {
    return true
  }

  // Check if placing toChar on fromTeam would violate duplicate constraint
  if (fromTeamChars.has(toChar)) {
    return true
  }

  return false
}

// Helper to store companion positions before skill deactivation
function storeCompanionPositions(grid: Grid, characterId: number, team: Team): CompanionPosition[] {
  const positions: CompanionPosition[] = []
  const companions = grid.getCompanions(characterId, team)

  companions.forEach((companionId) => {
    const hexId = grid.findCharacterHex(companionId, team)
    if (hexId !== null) {
      positions.push({
        companionId,
        hexId,
        team,
        mainCharId: characterId,
      })
    }
  })

  return positions
}

// Helper to restore companions to original positions
function restoreCompanions(
  grid: Grid,
  skillManager: SkillManager,
  mainCharId: number,
  companionPositions: CompanionPosition[],
): void {
  companionPositions
    .filter((pos) => pos.mainCharId === mainCharId)
    .forEach(({ companionId, hexId: originalHexId, team }) => {
      const currentHexId = grid.findCharacterHex(companionId, team)
      if (currentHexId !== null && currentHexId !== originalHexId) {
        // Remove from current position
        if (!grid.removeCharacter(currentHexId, true)) {
          console.warn(
            `Failed to remove companion ${companionId} from hex ${currentHexId} during restoration`,
          )
        }
        // Place at original position
        grid.placeCharacter(originalHexId, companionId, team, true)
        // Re-add color modifier (use companion color for companions)
        const skill = getCharacterSkill(mainCharId)
        if (skill?.companionColorModifier) {
          skillManager.addCharacterColorModifier(companionId, team, skill.companionColorModifier)
        }
      }
    })
}

// Helper to perform cross-team character swap with skill handling
function performCrossTeamSwap(
  grid: Grid,
  skillManager: SkillManager,
  fromHexId: number,
  toHexId: number,
  fromChar: number,
  toChar: number,
  fromTeam: Team,
  toTeam: Team,
): boolean {
  // Check if swap would create duplicates
  if (wouldCreateDuplicate(grid, fromChar, toChar, fromTeam, toTeam)) {
    return false
  }

  const fromHasSkill = skillManager.hasActiveSkill(fromChar, fromTeam)
  const toHasSkill = skillManager.hasActiveSkill(toChar, toTeam)

  // Store companion positions before deactivation (only for characters with skills)
  const companionPositions: CompanionPosition[] = []
  if (fromHasSkill) {
    companionPositions.push(...storeCompanionPositions(grid, fromChar, fromTeam))
  }
  if (toHasSkill) {
    companionPositions.push(...storeCompanionPositions(grid, toChar, toTeam))
  }

  let skillsDeactivated = false

  const result = executeTransaction(
    [
      // Step 1: Deactivate skills if needed
      () => {
        if (fromHasSkill) {
          skillManager.deactivateCharacterSkill(fromChar, fromHexId, fromTeam, grid)
        }
        if (toHasSkill) {
          skillManager.deactivateCharacterSkill(toChar, toHexId, toTeam, grid)
        }
        skillsDeactivated = true
        return true
      },
      // Step 2: Perform the swap using atomic helper
      // For cross-team swap, characters switch teams:
      // - fromChar moves to toHexId and JOINS toTeam
      // - toChar moves to fromHexId and JOINS fromTeam
      () =>
        performAtomicSwap(
          grid,
          fromHexId,
          toHexId,
          fromChar,
          toChar,
          fromTeam, // toChar placed at fromHexId with fromTeam (switches to fromTeam)
          toTeam, // fromChar placed at toHexId with toTeam (switches to toTeam)
          fromTeam, // Original teams for rollback
          toTeam,
        ),
      // Step 3: Reactivate skills at new positions with NEW teams
      () => {
        // fromChar has moved to toHexId and joined toTeam
        if (hasSkill(fromChar)) {
          if (!skillManager.activateCharacterSkill(fromChar, toHexId, toTeam, grid)) {
            return false
          }
        }
        // toChar has moved to fromHexId and joined fromTeam
        if (hasSkill(toChar)) {
          if (!skillManager.activateCharacterSkill(toChar, fromHexId, fromTeam, grid)) {
            return false
          }
        }
        return true
      },
    ],
    [
      // Rollback: Reactivate original skills if something failed
      () => {
        if (!skillsDeactivated) return

        // Handle fromChar skill reactivation
        if (fromHasSkill) {
          skillManager.activateCharacterSkill(fromChar, fromHexId, fromTeam, grid)
          // Special handling for companion skills to restore companion positions
          if (hasCompanionSkill(fromChar)) {
            restoreCompanions(grid, skillManager, fromChar, companionPositions)
          }
        }

        // Handle toChar skill reactivation
        if (toHasSkill) {
          skillManager.activateCharacterSkill(toChar, toHexId, toTeam, grid)
          // Special handling for companion skills to restore companion positions
          if (hasCompanionSkill(toChar)) {
            restoreCompanions(grid, skillManager, toChar, companionPositions)
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

// Private helper that performs the atomic swap operation
function performAtomicSwap(
  grid: Grid,
  fromHexId: number,
  toHexId: number,
  fromChar: number,
  toChar: number,
  fromTargetTeam: Team,
  toTargetTeam: Team,
  fromOriginalTeam: Team,
  toOriginalTeam: Team,
): boolean {
  // Execute swap as transaction
  const result = executeTransaction(
    // Operations to execute
    [
      () => {
        return grid.removeCharacter(fromHexId, true)
      },
      () => {
        return grid.removeCharacter(toHexId, true)
      },
      () => {
        return grid.placeCharacter(fromHexId, toChar, fromTargetTeam, true)
      },
      () => {
        return grid.placeCharacter(toHexId, fromChar, toTargetTeam, true)
      },
    ],
    // Rollback operations
    [
      () => {
        grid.placeCharacter(fromHexId, fromChar, fromOriginalTeam, true)
      },
      () => {
        grid.placeCharacter(toHexId, toChar, toOriginalTeam, true)
      },
    ],
  )

  return result
}

export function executeSwapCharacters(
  grid: Grid,
  skillManager: SkillManager,
  fromHexId: number,
  toHexId: number,
): boolean {
  // 1. Perform all validations

  // Basic validation
  if (fromHexId == toHexId) return false

  // Get character and team info
  const fromChar = grid.getCharacter(fromHexId)
  const toChar = grid.getCharacter(toHexId)
  const fromTeam = grid.getCharacterTeam(fromHexId)
  const toTeam = grid.getCharacterTeam(toHexId)

  // Validate all required data exists
  if (!fromChar || !toChar || !fromTeam || !toTeam) return false

  // Companions can only be swapped within the same team
  if ((grid.isCompanionId(fromChar) || grid.isCompanionId(toChar)) && fromTeam !== toTeam) {
    return false
  }

  // 2. Determine swap type and execute

  const isSameTeam = fromTeam == toTeam
  const fromHasSkill = hasSkill(fromChar)
  const toHasSkill = hasSkill(toChar)
  const needsSkillHandling = !isSameTeam && (fromHasSkill || toHasSkill)

  // 2a. Simple swap (same team or cross-team with no skills)
  if (isSameTeam || !needsSkillHandling) {
    const result = performAtomicSwap(
      grid,
      fromHexId,
      toHexId,
      fromChar,
      toChar,
      fromTeam,
      toTeam,
      fromTeam,
      toTeam,
    )

    // Trigger skill updates after successful transaction
    if (result && grid.skillManager) {
      grid.skillManager.updateActiveSkills(grid)
    }

    return result
  }

  // 2b. Cross-team swap with skills involved
  return performCrossTeamSwap(
    grid,
    skillManager,
    fromHexId,
    toHexId,
    fromChar,
    toChar,
    fromTeam,
    toTeam,
  )
}

export function executeMoveCharacter(
  grid: Grid,
  skillManager: SkillManager,
  fromHexId: number,
  toHexId: number,
  characterId: number,
): boolean {
  const fromTeam = grid.getCharacterTeam(fromHexId)
  if (!fromTeam) return false

  // Determine target team from tile state
  const toTile = grid.getTileById(toHexId)
  const toTeam = getTeamFromTileState(toTile.state)
  if (!toTeam) return false

  const changingTeams = fromTeam !== toTeam

  // Companions cannot be moved to opposite team
  if (grid.isCompanionId(characterId) && changingTeams) {
    return false
  }

  // If not changing teams, use simple move
  if (!changingTeams) {
    return grid.moveCharacter(fromHexId, toHexId, characterId)
  }

  // For cross-team moves with skills, we need proper transaction handling
  const hasActiveSkill = skillManager.hasActiveSkill(characterId, fromTeam)

  // Store companion positions before deactivation (for rollback if needed)
  let companionPositions: CompanionPosition[] = []
  if (hasActiveSkill && hasSkill(characterId)) {
    companionPositions = storeCompanionPositions(grid, characterId, fromTeam)
  }

  let skillDeactivated = false
  let moved = false

  // Execute as a transaction
  const result = executeTransaction(
    [
      // Step 1: Deactivate skill if needed
      () => {
        if (hasActiveSkill) {
          skillManager.deactivateCharacterSkill(characterId, fromHexId, fromTeam, grid)
          skillDeactivated = true
        }
        return true
      },
      // Step 2: Attempt the move
      () => {
        moved = grid.moveCharacter(fromHexId, toHexId, characterId)
        return moved
      },
      // Step 3: Reactivate skill at new position if move succeeded
      () => {
        if (moved && hasSkill(characterId)) {
          return skillManager.activateCharacterSkill(characterId, toHexId, toTeam, grid)
        }
        return true
      },
    ],
    [
      // Rollback: Restore skill if it was deactivated
      () => {
        if (skillDeactivated && !moved) {
          // Reactivate the skill at original position
          skillManager.activateCharacterSkill(characterId, fromHexId, fromTeam, grid)

          // Special handling for companion skills to restore companion positions
          if (hasCompanionSkill(characterId)) {
            restoreCompanions(grid, skillManager, characterId, companionPositions)
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
  if (!grid.canPlaceCharacter(characterId, team)) return false

  // Get all available tiles for this team
  const availableTiles = grid.getAllAvailableTilesForTeam(team)
  if (availableTiles.length == 0) return false

  // Sort by hex ID descending (largest first) for deterministic randomness
  availableTiles.sort((a, b) => b.hex.getId() - a.hex.getId())

  // Select random tile from available options
  const randomIndex = Math.floor(Math.random() * availableTiles.length)
  const selectedTile = availableTiles[randomIndex]

  if (!selectedTile) {
    console.error('executeAutoPlaceCharacter: Selected tile is undefined despite non-empty availableTiles array', {
      randomIndex,
      availableTilesLength: availableTiles.length,
    })
    return false
  }

  const hexId = selectedTile.hex.getId()

  // Place character
  const placed = grid.placeCharacter(hexId, characterId, team, true)
  if (!placed) return false

  // Activate skill if character has one
  if (hasSkill(characterId)) {
    const activated = skillManager.activateCharacterSkill(characterId, hexId, team, grid)

    if (!activated) {
      // Clean up on skill failure
      if (!grid.removeCharacter(hexId, true)) {
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

export function executeHandleHexClick(
  grid: Grid,
  skillManager: SkillManager,
  hexId: number,
): boolean {
  if (grid.hasCharacter(hexId)) {
    return executeRemoveCharacter(grid, skillManager, hexId)
  }
  return false
}

// Helper function to determine team from tile state
function getTeamFromTileState(state: State): Team | null {
  if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) return Team.ALLY
  if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) return Team.ENEMY
  return null
}
