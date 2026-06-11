import { registerSkill } from '../registry'
import { createCompanionSkill } from '../utils/builders'

registerSkill(
  createCompanionSkill({
    id: 'elijah-lailah',
    characterId: 68,
    name: 'Twins',
    description:
      'Elijah and Lailah appear as separate units on the map, increasing team capacity by 1. If either Elijah or Lailah is removed, both are removed. Lailah has a range of 1',
    colorModifier: '#51abcb',
    companionColorModifier: '#cd7169',
    companionRange: 1,
  }),
)
