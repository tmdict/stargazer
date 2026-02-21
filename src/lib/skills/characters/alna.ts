import { registerSkill } from '../registry'
import { type Skill, type SkillContext, type SkillTargetInfo } from '../skill'
import { searchByRow } from '../utils/ring'

/**
 * Calculate Alna's Winter Warrior target.
 * Targets the closest ally in the same diagonal row.
 * Tie-breaking: higher hex ID for ally team, lower hex ID for enemy team.
 */
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return searchByRow(context, context.team)
}

const alnaSkill: Skill = {
  id: 'alna',
  characterId: 100,
  name: 'Winter Warrior',
  description:
    'Alna targets the closest ally in the same row as herself to become the Winter Warrior. When two allies are at equal distance, the one with the higher hex ID is selected (reversed when Alna is on the enemy side).',
  targetingColorModifier: '#4fc3f7',

  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context

    const targetInfo = calculateTarget(context)
    if (targetInfo && targetInfo.targetHexId) {
      targetInfo.metadata = {
        ...targetInfo.metadata,
        arrows: [{ fromHexId: hexId, toHexId: targetInfo.targetHexId, type: 'ally' }],
      }
      skillManager.setSkillTarget(characterId, team, targetInfo)
    }
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context
    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context

    const targetInfo = calculateTarget(context)
    if (targetInfo && targetInfo.targetHexId) {
      targetInfo.metadata = {
        ...targetInfo.metadata,
        arrows: [{ fromHexId: hexId, toHexId: targetInfo.targetHexId, type: 'ally' }],
      }
      skillManager.setSkillTarget(characterId, team, targetInfo)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  },
}

registerSkill(alnaSkill)
