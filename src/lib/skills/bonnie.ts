import { getOpposingTeam } from '../characters/character'
import type { Skill, SkillContext, SkillTargetInfo } from './skill'
import { findRearmostTarget } from './utils/targeting'

/**
 * Targets the rearmost character on the opposing team.
 */
export function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const opposingTeam = getOpposingTeam(context.team)
  return findRearmostTarget(context, opposingTeam)
}

export const bonnieSkill: Skill = {
  id: 'bonnie',
  characterId: 66,
  name: "Decay's Reach",
  description: 'Targets the rearmost enemy character on the opposing team.',
  targetingColorModifier: '#98be5d',

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
