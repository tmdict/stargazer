import { registerSkill } from '../registry'
import { createCompanionSkill } from '../utils/builders'

registerSkill(
  createCompanionSkill({
    id: 'zanie',
    characterId: 89,
    name: 'Turret',
    description:
      'Places 2 turrets on the map, increasing team capacity by 2. If either Zanie or her turrets are removed, all are removed. Each turret has a range of 3',
    count: 2,
    companionImageModifier: 'zanie-turret',
    companionRange: 3,
  }),
)
