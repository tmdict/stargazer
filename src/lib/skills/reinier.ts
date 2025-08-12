import type { Skill, SkillContext, SkillTargetInfo } from '../skill'

export const reinierSkill: Skill = {
  id: 'reinier',
  characterId: 31,
  name: 'Dynamic Balance',
  description:
    'Targets an adjacent ally position with an enemy hero if both the ally and enemy are placed on a symmetrical tile.',
  targetingColorModifier: '#9925be', // Purple color for Reinier's swap indicator

  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context
  },

  onUpdate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context
  },
}
