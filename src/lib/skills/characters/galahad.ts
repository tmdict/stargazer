import { registerSkill } from '../registry'
import { type Skill, type SkillContext, type SkillTargetInfo } from '../skill'
import { rowScan, RowScanDirection } from '../utils/ring'

function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return rowScan(context, context.team, {
    direction: RowScanDirection.REARMOST,
    excludeCompanions: true,
  })
}

function updateSkillTargets(context: SkillContext): void {
  const { skillManager, team, characterId } = context

  // Clear previous tile modifier
  const previousTarget = skillManager.getSkillTarget(characterId, team)
  if (previousTarget?.targetHexId) {
    skillManager.removeTileColorModifier(
      previousTarget.targetHexId,
      galahadSkill.tileColorModifier!,
    )
  }

  const targetInfo = calculateTarget(context)
  if (targetInfo?.targetHexId) {
    skillManager.setSkillTarget(characterId, team, targetInfo)
    skillManager.setTileColorModifier(targetInfo.targetHexId, galahadSkill.tileColorModifier!)
  } else {
    skillManager.clearSkillTarget(characterId, team)
  }
}

const galahadSkill: Skill = {
  id: 'galahad',
  characterId: 99,
  name: 'Time Recast',
  description:
    'Targets the nearest ally starting from tiles adjacent to her and expanding outwards, prioritizing characters in the back. Cannot target clones or summoned units.',
  tileColorModifier: '#e57373',

  onActivate(context: SkillContext): void {
    updateSkillTargets(context)
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    const currentTarget = skillManager.getSkillTarget(characterId, team)
    if (currentTarget?.targetHexId) {
      skillManager.removeTileColorModifier(
        currentTarget.targetHexId,
        galahadSkill.tileColorModifier!,
      )
    }

    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    updateSkillTargets(context)
  },
}

registerSkill(galahadSkill)
