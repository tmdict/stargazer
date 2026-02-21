import { registerSkill } from '../registry'
import { type Skill, type SkillContext, type SkillTargetInfo } from '../skill'
import { findTarget, TargetingMethod } from '../utils/distance'

/**
 * Calculate the rearmost ally to target
 */
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  // Target the rearmost ally on the same team using the standardized targeting function
  return findTarget(context, {
    targetTeam: context.team,
    excludeSelf: true,
    targetingMethod: TargetingMethod.REARMOST,
  })
}

const pandoraSkill: Skill = {
  id: 'pandora',
  characterId: 85,
  name: 'Boxed Blessing',
  description: 'Targets the rearmost ally character on the same team.',
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

registerSkill(pandoraSkill)
