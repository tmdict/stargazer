import { registerSkill } from '../registry'
import { createCompanionSkill } from '../utils/builders'

registerSkill(
  createCompanionSkill({
    id: 'phraesto',
    characterId: 50,
    name: 'Shadow Companion',
    description:
      'Creates a shadow companion Phraesto, increasing team capacity by 1. If either Phraesto is removed, both are removed.',
    colorModifier: '#ffffff',
    companionColorModifier: '#c83232',
  }),
)
