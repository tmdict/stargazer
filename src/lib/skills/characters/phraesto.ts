import { registerSkill } from '../registry'
import { createCompanionSkill } from '../utils/builders'

// Spawns a shadow Phraesto, increasing team capacity by 1. Removing either
// Phraesto removes both.
registerSkill(
  createCompanionSkill({
    id: 'phraesto',
    characterId: 50,
    colorModifier: '#ffffff',
    companionColorModifier: '#c83232',
  }),
)
