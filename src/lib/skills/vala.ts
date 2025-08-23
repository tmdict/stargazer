import type { Skill, SkillContext, SkillTargetInfo } from '../skill'
import { findTarget, getOpposingTeam, TargetingMethod, TieBreaker } from './utils/targeting'

// Calculate the furthest opposing target from Vala's position
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return findTarget(context, {
    targetTeam: getOpposingTeam(context.team), // Opposing team
    targetingMethod: TargetingMethod.FURTHEST,
    tieBreaker: TieBreaker.HEX_ID,
  })
}

export const valaSkill: Skill = {
  id: 'vala',
  characterId: 46,
  name: 'Assassin',
  description:
    'Targets the character on the opposing team that is furthest from the current tile of Vala.',
  targetingColorModifier: '#9661f1', // Purple color for targeting arrow

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
