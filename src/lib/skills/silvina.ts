import type { Skill, SkillContext } from '../skill'
import { State } from '../types/state'
import { Team } from '../types/team'

export const phraestoSkill: Skill = {
  id: 'silvina',
  characterId: 39,
  name: 'First Strike',
  description:
    'Targets the character on the oppositing team on a symmetrical tile to Silvina, If no character character is found on the symmetrical tile, target the closest opposing character to the symmetrical tile.',

  colorModifier: '#000000',

  onActivate(context: SkillContext): void {
    const { grid, team, characterId, skillManager, hexId } = context
  },

  onDeactivate(context: SkillContext): void {
    const { grid, team, characterId, skillManager, hexId } = context
  },
}
