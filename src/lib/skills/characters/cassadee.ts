import { registerSkill } from '../registry'
import { type Skill, type SkillContext, type SkillTargetInfo } from '../skill'
import { rowScan, RowScanDirection } from '../utils/ring'

function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return rowScan(context, context.team, RowScanDirection.REARMOST)
}

function updateSkillTargets(context: SkillContext): void {
  const { skillManager, team, characterId } = context

  // Clear previous tile modifier
  const previousTarget = skillManager.getSkillTarget(characterId, team)
  if (previousTarget?.targetHexId) {
    skillManager.removeTileColorModifier(
      previousTarget.targetHexId,
      cassadeeSkill.tileColorModifier!,
    )
  }

  const targetInfo = calculateTarget(context)
  if (targetInfo?.targetHexId) {
    skillManager.setSkillTarget(characterId, team, targetInfo)
    skillManager.setTileColorModifier(targetInfo.targetHexId, cassadeeSkill.tileColorModifier!)
  } else {
    skillManager.clearSkillTarget(characterId, team)
  }
}

const cassadeeSkill: Skill = {
  id: 'cassadee',
  characterId: 10,
  name: 'Tidal Strength',
  description:
    'Targets the nearest ally starting from tiles adjacent to her and expanding outwards, prioritizing characters in the back (lower hex ID for ally team, higher for enemy team).',
  tileColorModifier: '#4fc3f7',

  onActivate(context: SkillContext): void {
    updateSkillTargets(context)
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    const currentTarget = skillManager.getSkillTarget(characterId, team)
    if (currentTarget?.targetHexId) {
      skillManager.removeTileColorModifier(
        currentTarget.targetHexId,
        cassadeeSkill.tileColorModifier!,
      )
    }

    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    updateSkillTargets(context)
  },
}

registerSkill(cassadeeSkill)
