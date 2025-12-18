import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import { type Skill, type SkillContext, type SkillTargetInfo } from '../skill'
import { findTarget, TargetingMethod } from '../utils/targeting'

// Calculate the furthest opposing target from current position
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return findTarget(context, {
    targetTeam: getOpposingTeam(context.team), // Opposing team
    targetingMethod: TargetingMethod.FURTHEST,
  })
}

const valaSkill: Skill = {
  id: 'vala',
  characterId: 46,
  name: 'Assassin',
  description:
    'Targets the enemy character on the opposing team that is furthest from the current tile of Vala.',
  targetingColorModifier: '#9661f1',

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

registerSkill(valaSkill)
