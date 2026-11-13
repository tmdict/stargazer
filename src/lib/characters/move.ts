import { getTeamFromTileState } from '../../utils/tileStateFormatting'
import type { Grid } from '../grid'
import { hasCompanionSkill, hasSkill, SkillManager } from '../skills/skill'
import { Team } from '../types/team'
import { canPlaceCharacterOnTeam, getCharacter, getCharacterTeam, hasCharacter } from './character'
import { isCompanionId, restoreCompanions, storeCompanionPositions } from './companion'
import { performPlace } from './place'
import { performRemove } from './remove'
import { isSynergyHeroId } from './synergy'
import { executeTransaction } from './transaction'

// High-level operations

// The rules a move onto an empty tile must pass. The drag hover cue reads them
// too, so a drop it shows as allowed is one the move takes.
export function canMoveCharacter(
  grid: Grid,
  fromHexId: number,
  toHexId: number,
  characterId: number,
): boolean {
  if (fromHexId == toHexId) return false
  if (getCharacter(grid, fromHexId) != characterId) return false

  const fromTeam = getCharacterTeam(grid, fromHexId)
  const toTeam = getTeamFromTileState(grid.getTileById(toHexId).state)
  if (!fromTeam || !toTeam || hasCharacter(grid, toHexId)) return false
  // Within a team the unit keeps the slot it holds.
  if (fromTeam === toTeam) return true

  // Companions can't change teams, and neither can a synergy hero: the
  // destination team's assist slot may already be taken.
  if (isCompanionId(grid, characterId) || isSynergyHeroId(characterId)) return false
  return canPlaceCharacterOnTeam(grid, characterId, toTeam)
}

export function executeMoveCharacter(
  grid: Grid,
  skillManager: SkillManager,
  fromHexId: number,
  toHexId: number,
  characterId: number,
): boolean {
  if (!canMoveCharacter(grid, fromHexId, toHexId, characterId)) return false
  const fromTeam = getCharacterTeam(grid, fromHexId)!
  const toTeam = getTeamFromTileState(grid.getTileById(toHexId).state)!
  const changingTeams = fromTeam != toTeam

  const hasCharacterSkill = hasSkill(characterId)
  const needsSkillHandling = changingTeams && hasCharacterSkill

  // Simple move (same team OR cross-team with no skills)
  if (!needsSkillHandling) {
    const result = performMove(grid, fromHexId, toHexId, characterId, toTeam, fromTeam)

    if (result && grid.skillManager) {
      grid.skillManager.updateActiveSkills(grid)
    }
    return result
  }

  // Cross-team move with skills
  const result = performCrossTeamMove(
    grid,
    skillManager,
    fromHexId,
    toHexId,
    characterId,
    toTeam,
    fromTeam,
  )

  if (result && grid.skillManager) {
    grid.skillManager.updateActiveSkills(grid)
  }
  return result
}

// Atomic operations

function performMove(
  grid: Grid,
  fromHexId: number,
  toHexId: number,
  characterId: number,
  targetTeam: Team,
  originalTeam: Team,
): boolean {
  return executeTransaction(
    [
      () => performRemove(grid, fromHexId),
      () => performPlace(grid, toHexId, characterId, targetTeam),
    ],
    [() => performPlace(grid, fromHexId, characterId, originalTeam)],
  )
}

function performCrossTeamMove(
  grid: Grid,
  skillManager: SkillManager,
  fromHexId: number,
  toHexId: number,
  characterId: number,
  targetTeam: Team,
  originalTeam: Team,
): boolean {
  let companionPositions: ReturnType<typeof storeCompanionPositions> = []
  let skillDeactivated = false
  let movePerformed = false

  return executeTransaction(
    [
      // Step 1: Store companions and deactivate skill
      () => {
        companionPositions = storeCompanionPositions(grid, characterId, originalTeam)
        skillManager.deactivateCharacterSkill(characterId, fromHexId, originalTeam, grid)
        skillDeactivated = true
        return true
      },
      // Step 2: Execute the move
      () => {
        movePerformed = performMove(grid, fromHexId, toHexId, characterId, targetTeam, originalTeam)
        return movePerformed
      },
      // Step 3: Activate skill at new position with new team
      () => skillManager.activateCharacterSkill(characterId, toHexId, targetTeam, grid),
    ],
    [
      // Rollback: first reverse the move if it was performed, then reactivate
      // the original skill. If the move never happened (or failed), performMove's
      // own transaction already restored the character at fromHexId.
      () => {
        if (movePerformed) {
          performMove(grid, toHexId, fromHexId, characterId, originalTeam, targetTeam)
        }
        if (skillDeactivated && hasSkill(characterId)) {
          skillManager.activateCharacterSkill(characterId, fromHexId, originalTeam, grid)
          if (hasCompanionSkill(characterId)) {
            restoreCompanions(grid, skillManager, characterId, companionPositions)
          }
        }
      },
    ],
  )
}
