import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { findRearmostTarget } from '../utils/distance'

// Targets the rearmost enemy on the opposing team.
registerSkill(
  createTargetingSkill({
    id: 'bonnie',
    characterId: 66,
    color: SKILL_COLORS.green,
    arrowType: 'enemy',
    calculateTarget: (ctx) => findRearmostTarget(ctx, getOpposingTeam(ctx.team)),
  }),
)
