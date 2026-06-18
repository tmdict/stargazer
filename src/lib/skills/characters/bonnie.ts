import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findRearmostTarget } from '../utils/distance'

// Targets the rearmost enemy on the opposing team.
registerSkill(
  createTargetingSkill({
    id: 'bonnie',
    characterId: 66,
    color: '#98be5d',
    arrowType: 'enemy',
    calculateTarget: (ctx) => findRearmostTarget(ctx, getOpposingTeam(ctx.team)),
  }),
)
