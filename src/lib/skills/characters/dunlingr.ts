import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

registerSkill(
  createTargetingSkill({
    id: 'dunlingr',
    characterId: 57,
    name: 'Bell of Order',
    description:
      'Targets the ally character on the same team that is furthest from the current tile of Dunlingr.',
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
