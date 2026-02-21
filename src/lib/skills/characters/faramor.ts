import { registerSkill } from '../registry'
import { type Skill, type SkillContext, type SkillTargetInfo } from '../skill'
import { rowScan, RowScanDirection } from '../utils/ring'

function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return rowScan(context, context.team, {
    direction: RowScanDirection.REARMOST,
    maxDistance: 1,
  })
}

function updateSkillTargets(context: SkillContext): void {
  const { skillManager, team, characterId } = context

  // Clear previous tile modifier
  const previousTarget = skillManager.getSkillTarget(characterId, team)
  if (previousTarget?.targetHexId) {
    skillManager.removeTileColorModifier(
      previousTarget.targetHexId,
      faramorSkill.tileColorModifier!,
    )
  }

  const targetInfo = calculateTarget(context)
  if (targetInfo?.targetHexId) {
    skillManager.setSkillTarget(characterId, team, targetInfo)
    skillManager.setTileColorModifier(targetInfo.targetHexId, faramorSkill.tileColorModifier!)
  } else {
    skillManager.clearSkillTarget(characterId, team)
  }
}

const faramorSkill: Skill = {
  id: 'faramor',
  characterId: 75,
  name: 'Sacred Pledge',
  description:
    'Targets the nearest ally on tiles adjacent to him, prioritizing characters in the back (lower hex ID for ally team, higher for enemy team).',
  tileColorModifier: '#6d9c86',

  onActivate(context: SkillContext): void {
    updateSkillTargets(context)
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    const currentTarget = skillManager.getSkillTarget(characterId, team)
    if (currentTarget?.targetHexId) {
      skillManager.removeTileColorModifier(
        currentTarget.targetHexId,
        faramorSkill.tileColorModifier!,
      )
    }

    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    updateSkillTargets(context)
  },
}

registerSkill(faramorSkill)
