import type { Grid } from '../grid'
import { hasCompanionSkill, hasSkill, SkillManager } from '../skills/skill'
import { Team } from '../types/team'
import { getCharacter, getCharacterTeam, hasCharacter, isCharacterOnTeam } from './character'
import { isCompanionId, restoreCompanions, storeCompanionPositions } from './companion'
import { isPhantimalId } from './phantimal'
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

  // Phantimals are tied to their team's faction hero count and companions to
  // their main character, so both can only swap within their own team
  if (
    fromTeam !== toTeam &&
    (isPhantimalId(fromChar) ||
      isPhantimalId(toChar) ||
      isCompanionId(grid, fromChar) ||
      isCompanionId(grid, toChar))
  ) {
    return false
  }

  // Cross-team swaps must not duplicate a character on its destination team
  // (the same character may legally exist once on each team)
  if (
    fromTeam !== toTeam &&
    (isCharacterOnTeam(grid, fromChar, toTeam) || isCharacterOnTeam(grid, toChar, fromTeam))
  ) {
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
// Parameters:
// - toCharDestTeam: The team that toChar will join when placed at fromHexId
// - fromCharDestTeam: The team that fromChar will join when placed at toHexId
// - fromCharOriginalTeam: The original team of fromChar (for rollback)
// - toCharOriginalTeam: The original team of toChar (for rollback)
function performSwap(
  grid: Grid,
  fromHexId: number,
  toHexId: number,
  fromChar: number,
  toChar: number,
  toCharDestTeam: Team,
  fromCharDestTeam: Team,
  fromCharOriginalTeam: Team,
  toCharOriginalTeam: Team,
): boolean {
  // Execute swap as transaction
  const result = executeTransaction(
    // Operations to execute
    [
      () => {
        return performRemove(grid, fromHexId)
      },
      () => {
        return performRemove(grid, toHexId)
      },
      () => {
        return performPlace(grid, fromHexId, toChar, toCharDestTeam)
      },
      () => {
        return performPlace(grid, toHexId, fromChar, fromCharDestTeam)
      },
    ],
    // Rollback: clear any partial swap state from both tiles, then restore both
    // characters to their original positions and teams. performPlace never
    // overwrites an occupant, so the tiles must be cleared first.
    [
      () => {
        if (hasCharacter(grid, fromHexId)) performRemove(grid, fromHexId)
        if (hasCharacter(grid, toHexId)) performRemove(grid, toHexId)
        if (!performPlace(grid, fromHexId, fromChar, fromCharOriginalTeam)) {
          console.warn(`Swap rollback failed to restore character ${fromChar} at hex ${fromHexId}`)
        }
        if (!performPlace(grid, toHexId, toChar, toCharOriginalTeam)) {
          console.warn(`Swap rollback failed to restore character ${toChar} at hex ${toHexId}`)
        }
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
  let swapPerformed = false

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
      () => {
        const swapResult = performSwap(
          grid,
          fromHexId,
          toHexId,
          fromChar,
          toChar,
          fromTeam, // toChar placed at fromHexId with fromTeam (switches to fromTeam)
          toTeam, // fromChar placed at toHexId with toTeam (switches to toTeam)
          fromTeam, // Original teams for rollback
          toTeam,
        )
        if (swapResult) {
          swapPerformed = true
        }
        return swapResult
      },
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
      // Rollback: First reverse the swap if it was performed, then reactivate original skills
      () => {
        // If swap was performed but skill activation failed, we need to reverse the swap
        if (swapPerformed) {
          // Manually reverse the swap back to original positions and teams
          performSwap(
            grid,
            fromHexId,
            toHexId,
            toChar, // Swap them back
            fromChar, // Swap them back
            fromTeam, // Original teams
            toTeam, // Original teams
            fromTeam, // Keep original teams for any nested rollback
            toTeam,
          )
        }

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
