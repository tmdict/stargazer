import type { Skill, SkillContext, SkillTargetInfo } from '../skill'

export const valaSkill: Skill = {
  id: 'vala',
  characterId: 46,
  name: 'Assassin',
  description:
    'Targets the character on the opposing team that is furthest from the current tile of Vala.',
  targetingColorModifier: '#8b6f8e ', // Purple color for Vala's targeting arrow

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
