import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the ally on the same team furthest from Dunlingr.
registerSkill(
  createTargetingSkill({
    id: 'dunlingr',
    characterId: 57,
    color: '#ffa000',
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.FURTHEST,
      }),
  }),
)
