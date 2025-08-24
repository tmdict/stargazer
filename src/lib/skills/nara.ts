import type { Skill, SkillContext, SkillTargetInfo } from '../skill'
import { getSymmetricalHexId } from './utils/symmetry'
import { getOpposingTeam, spiralSearchFromTile } from './utils/targeting'

/**
 * Calculate the target for skill.
 *
 * Targeting priority:
 * 1. Enemy on the symmetrical tile
 * 2. Nearest enemy to the symmetrical tile via spiral search
 */
export function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, hexId } = context
  const opposingTeam = getOpposingTeam(team)

  const symmetricalHexId = getSymmetricalHexId(hexId)
  if (!symmetricalHexId) return null

  // Priority 1: Check for enemy on the symmetrical tile
  const symmetricalTile = grid.getTileById(symmetricalHexId)
  if (symmetricalTile?.characterId && symmetricalTile.team === opposingTeam) {
    return {
      targetHexId: symmetricalHexId,
      targetCharacterId: symmetricalTile.characterId,
      metadata: {
        symmetricalHexId,
        isSymmetricalTarget: true,
        examinedTiles: [symmetricalHexId], // Only examined the symmetrical tile
      },
    }
  }

  // Priority 2: Find nearest enemy via spiral search
  return spiralSearchFromTile(grid, symmetricalHexId, opposingTeam, team)
}

export const naraSkill: Skill = {
  id: 'nara',
  characterId: 58,
  name: 'Phantom Chains',
  description:
    'Targets the character on the opposing team on a symmetrical tile to Nara. If no character is found on the symmetrical tile, target the closest opposing character to the symmetrical tile.',
  targetingColorModifier: '#98be5d', // Green color for targeting arrow

  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context

    // Calculate initial target
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
      // Add source hex to metadata
      targetInfo.metadata = {
        ...targetInfo.metadata,
        sourceHexId: hexId,
      }
      // Store the targeting state
      skillManager.setSkillTarget(characterId, team, targetInfo)
    }
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Clear targeting state
    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context

    // Recalculate target on any grid change
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
      // Add source hex to metadata (hexId is now always current)
      targetInfo.metadata = {
        ...targetInfo.metadata,
        sourceHexId: hexId,
      }
      skillManager.setSkillTarget(characterId, team, targetInfo)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  },
}
