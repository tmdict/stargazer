import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { mirrorThenSpiralTarget } from '../utils/ring'

registerSkill(
  createTargetingSkill({
    id: 'nara',
    characterId: 58,
    color: SKILL_COLORS.green,
    arrowType: 'enemy',
    calculateTarget: mirrorThenSpiralTarget,
  }),
)
