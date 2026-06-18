import { registerSkill } from '../registry'
import { createCompanionSkill } from '../utils/builders'

// Places 2 turrets, increasing team capacity by 2. Removing Zanie or any turret
// removes all. Each turret has a range of 3.
registerSkill(
  createCompanionSkill({
    id: 'zanie',
    characterId: 89,
    count: 2,
    companionImageModifier: 'zanie-turret',
    companionRange: 3,
  }),
)
