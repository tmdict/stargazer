import type { Grid } from '../grid'
import { hasSkill, SkillManager } from '../skill'

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
