import { Team } from '../types/team'
import type { Skill, SkillContext, SkillTargetInfo } from './skill'
import { rowScan, searchByRow } from './utils/targeting'

/**
 * Calculate the target for Aliceth's skill.
 * First checks for allies in the same row, then expands outward if none found.
 */
export function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  // Phase 1: Search for allies in the same diagonal row
  const rowTarget = searchByRow(context, Team.ALLY)
  if (rowTarget) {
    return rowTarget
  }

  // Phase 2: If no allies in same row, scan outward from adjacent tiles
  return rowScan(context, Team.ALLY)
}

export const alicethSkill: Skill = {
  id: 'aliceth',
  characterId: 91,
  name: 'Guiding Light',
  description:
    'Aliceth targets the closest ally characters in the same row as her, prioritizing those on higher hex ID in case of a tie. If no character is found, Aliceth scans from the tiles adjacent to her, expanding outward from the highest hex ID to the lowest ID, targeting the first ally character found.',
  targetingColorModifier: '#ffa000',

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
