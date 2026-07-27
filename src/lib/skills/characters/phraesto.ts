import { registerSkill } from '../registry'
import { createCompanionSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'

// Spawns a shadow Phraesto, increasing team capacity by 1. Removing either
// Phraesto removes both.
registerSkill(
  createCompanionSkill({
    id: 'phraesto',
    characterId: 50,
    colorModifier: SKILL_COLORS.white,
    companionColorModifier: SKILL_COLORS.crimson,
  }),
)
