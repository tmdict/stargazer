import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findRearmostTarget } from '../utils/distance'

registerSkill(
  createTargetingSkill({
    id: 'bonnie',
    characterId: 66,
    name: "Decay's Reach",
    description: 'Targets the rearmost enemy character on the opposing team.',
    color: '#98be5d',
    arrowType: 'enemy',
    calculateTarget: (ctx) => findRearmostTarget(ctx, getOpposingTeam(ctx.team)),
  }),
)
