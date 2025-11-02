import type { Skill, SkillContext, SkillTargetInfo } from './skill'
import { findTarget, TargetingMethod } from './utils/targeting'

/**
 * Calculate the frontmost ally for Isabella to target
 */
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  // Target the frontmost ally on the same team using the standardized targeting function
  return findTarget(context, {
    targetTeam: context.team,
    excludeSelf: true,
    targetingMethod: TargetingMethod.FRONTMOST,
  })
}

export const isabellaSkill: Skill = {
  id: 'isabella',
  characterId: 93,
  name: 'Grimoire Pact',
  description: 'Targets the frontmost ally character on the same team.',
  targetingColorModifier: '#6d9c86',

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
