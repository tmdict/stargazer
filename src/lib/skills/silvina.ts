import type { Skill, SkillContext, SkillTargetInfo } from '../skill'
import type { Grid } from '../grid'
import { Team } from '../types/team'
import { getSymmetricalHexId } from './utils/symmetry'
import { findBestTarget } from './utils/targeting'

// Optimized target calculation for Silvina's skill
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, hexId } = context
  const opposingTeam = team === Team.ALLY ? Team.ENEMY : Team.ALLY

  // Get symmetrical hex ID using O(1) lookup
  const symmetricalHexId = getSymmetricalHexId(hexId)

  if (!symmetricalHexId) {
    // No valid symmetrical hex (shouldn't happen with valid grid)
    return null
  }

  // Check if there's an enemy on the symmetrical tile
  const symmetricalTile = grid.getTileById(symmetricalHexId)
  if (symmetricalTile?.characterId && symmetricalTile.team === opposingTeam) {
    // Direct symmetrical target found
    return {
      targetHexId: symmetricalHexId,
      targetCharacterId: symmetricalTile.characterId,
      metadata: {
        symmetricalHexId,
        isSymmetricalTarget: true,
      },
    }
  }

  // Find best enemy target with priority:
  // 1. Closest to symmetrical tile
  // 2. Closest to Silvina
  const bestTarget = findBestTarget(grid, team, [symmetricalHexId, hexId])

  if (bestTarget) {
    return {
      targetHexId: bestTarget.hexId,
      targetCharacterId: bestTarget.characterId,
      metadata: {
        symmetricalHexId,
        isSymmetricalTarget: false,
      },
    }
  }

  return null
}

export const silvinaSkill: Skill = {
  id: 'silvina',
  characterId: 39,
  name: 'First Strike',
  description:
    'Targets the character on the opposing team on a symmetrical tile to Silvina. If no character is found on the symmetrical tile, target the closest opposing character to the symmetrical tile.',
  targetingColorModifier: '#68ab21', // Green color for Silvina's targeting arrow

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
