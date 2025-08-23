import type { Skill, SkillContext, SkillTargetInfo } from '../skill'
import { findTarget, TargetingMethod } from './utils/targeting'

// Calculate the furthest same-team target from Dunlingr's position
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return findTarget(context, {
    targetTeam: context.team, // Same team
    excludeSelf: true,
    targetingMethod: TargetingMethod.FURTHEST,
  })
}

export const dunlingrSkill: Skill = {
  id: 'dunlingr',
  characterId: 57,
  name: 'Bell of Order',
  description:
    'Targets the character on the same team that is furthest from the current tile of Dunlingr.',
  targetingColorModifier: '#ffa000', // Yellow color for ally targeting

  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Calculate initial target
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
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
    const { team, skillManager, characterId } = context

    // Recalculate target on any grid change
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
      skillManager.setSkillTarget(characterId, team, targetInfo)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  },
}
