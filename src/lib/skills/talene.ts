import type { Skill, SkillContext, SkillTargetInfo } from './skill'
import { findTarget, TargetingMethod } from './utils/targeting'

/**
 * Calculate the frontmost ally to target
 */
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  // Target the frontmost ally on the same team using the standardized targeting function
  return findTarget(context, {
    targetTeam: context.team,
    excludeSelf: true,
    targetingMethod: TargetingMethod.FRONTMOST,
  })
}

export const taleneSkill: Skill = {
  id: 'talene',
  characterId: 52,
  name: 'Pyre of Renewal',
  description: 'Targets the frontmost ally character on the same team.',
  targetingColorModifier: '#c83232',

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
            type: 'ally',
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
            type: 'ally',
          },
        ],
      }
      skillManager.setSkillTarget(characterId, team, targetInfo)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  },
}
