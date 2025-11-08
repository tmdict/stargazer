import { getOpposingTeam } from '../characters/character'
import type { Skill, SkillContext, SkillTargetInfo } from './skill'
import { getSymmetricalHexId } from './utils/symmetry'
import { spiralSearchFromTile } from './utils/targeting'

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

export const silvinaSkill: Skill = {
  id: 'silvina',
  characterId: 39,
  name: 'First Strike',
  description:
    'Targets the enemy character on the opposing team on a symmetrical tile to Silvina. If no character is found on the symmetrical tile, target the closest opposing character to the symmetrical tile.',
  targetingColorModifier: '#6d9c86',

  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context

    // Calculate initial target
    const targetInfo = calculateTarget(context)
    if (targetInfo && targetInfo.targetHexId) {
      // Add arrow to metadata
      targetInfo.metadata = {
        ...targetInfo.metadata,
        arrows: [
          {
            fromHexId: hexId,
            toHexId: targetInfo.targetHexId,
            type: 'enemy',
          },
        ],
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
    if (targetInfo && targetInfo.targetHexId) {
      // Add arrow to metadata
      targetInfo.metadata = {
        ...targetInfo.metadata,
        arrows: [
          {
            fromHexId: hexId,
            toHexId: targetInfo.targetHexId,
            type: 'enemy',
          },
        ],
      }
      skillManager.setSkillTarget(characterId, team, targetInfo)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  },
}
