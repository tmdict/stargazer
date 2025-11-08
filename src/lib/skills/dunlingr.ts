import type { Skill, SkillContext, SkillTargetInfo } from './skill'
import { findTarget, TargetingMethod } from './utils/targeting'

// Calculate the furthest same-team target from current position
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
    'Targets the ally character on the same team that is furthest from the current tile of Dunlingr.',
  targetingColorModifier: '#ffa000',

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
