import type { Grid } from '../grid'
import { hasCompanionSkill, hasSkill, SkillManager } from '../skill'
import { Team } from '../types/team'
import { restoreCompanions, storeCompanionPositions } from './companion'
import { executeTransaction } from './transaction'

export function executeMoveCharacter(
  grid: Grid,
  skillManager: SkillManager,
  fromHexId: number,
  toHexId: number,
  characterId: number,
): boolean {
  // 1. Perform all validations

  // Basic validation
  if (fromHexId == toHexId) return false

  // Validate character ID matches
  const actualCharacterId = grid.getCharacter(fromHexId)
  if (actualCharacterId != characterId) return false

  // Get character team info
  const fromTeam = grid.getCharacterTeam(fromHexId)
  if (!fromTeam) return false

  // Determine target team from destination tile
  const toTile = grid.getTileById(toHexId)
  const toTeam = grid.getTeamFromTileState(toTile.state)
  if (!toTeam) return false

  const changingTeams = fromTeam != toTeam

  // Companion validation - companions can't change teams
  if (grid.isCompanionId(characterId) && changingTeams) {
    return false
  }

  // 2. Determine move type and execute

  const hasCharacterSkill = hasSkill(characterId)
  const needsSkillHandling = changingTeams && hasCharacterSkill

  // 2a. Simple move (same team OR cross-team with no skills)
  if (!needsSkillHandling) {
    const result = performAtomicMove(grid, fromHexId, toHexId, characterId, toTeam, fromTeam)

    if (result && grid.skillManager) {
      grid.skillManager.updateActiveSkills(grid)
    }
    return result
  }

  // 2b. Cross-team move with skills
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

// Performs atomic move of a single character
function performAtomicMove(
  grid: Grid,
  fromHexId: number,
  toHexId: number,
  characterId: number,
  targetTeam: Team,
  originalTeam: Team,
): boolean {
  return executeTransaction(
    [
      () => grid.removeCharacter(fromHexId, true),
      () => grid.placeCharacter(toHexId, characterId, targetTeam, true),
    ],
    [() => grid.placeCharacter(fromHexId, characterId, originalTeam, true)],
  )
}

// Performs cross-team move with skill handling
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
      () => performAtomicMove(grid, fromHexId, toHexId, characterId, targetTeam, originalTeam),
      // Step 3: Activate skill at new position with new team
      () => skillManager.activateCharacterSkill(characterId, toHexId, targetTeam, grid),
    ],
    [
      // Rollback
      () => {
        grid.placeCharacter(fromHexId, characterId, originalTeam, true)
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
