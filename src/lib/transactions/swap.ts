import { getCharacter, getCharacterTeam } from '../character'
import type { Grid } from '../grid'
import { hasCompanionSkill, hasSkill, SkillManager } from '../skill'
import { Team } from '../types/team'
import { restoreCompanions, storeCompanionPositions } from './companion'
import { performPlace } from './place'
import { performRemove } from './remove'
import { executeTransaction } from './transaction'

// High-level operations

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
  const fromChar = getCharacter(grid, fromHexId)
  const toChar = getCharacter(grid, toHexId)
  const fromTeam = getCharacterTeam(grid, fromHexId)
  const toTeam = getCharacterTeam(grid, toHexId)

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
    const result = performSwap(
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

// Atomic operations

// Performs atomic swap of two characters
function performSwap(
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
        return performRemove(grid, fromHexId, true)
      },
      () => {
        return performRemove(grid, toHexId, true)
      },
      () => {
        return performPlace(grid, fromHexId, toChar, fromTargetTeam, true)
      },
      () => {
        return performPlace(grid, toHexId, fromChar, toTargetTeam, true)
      },
    ],
    // Rollback operations
    [
      () => {
        performPlace(grid, fromHexId, fromChar, fromOriginalTeam, true)
      },
      () => {
        performPlace(grid, toHexId, toChar, toOriginalTeam, true)
      },
    ],
  )

  return result
}

// Performs cross-team character swap with skill handling
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
  if (grid.isCharacterOnTeam(fromChar, toTeam) || grid.isCharacterOnTeam(toChar, fromTeam)) {
    return false
  }

  const fromHasSkill = skillManager.hasActiveSkill(fromChar, fromTeam)
  const toHasSkill = skillManager.hasActiveSkill(toChar, toTeam)

  // Store companion positions before deactivation (only for characters with skills)
  const companionPositions: ReturnType<typeof storeCompanionPositions> = []
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
        performSwap(
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
