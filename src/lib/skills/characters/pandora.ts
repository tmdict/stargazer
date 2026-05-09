import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

registerSkill(
  createTargetingSkill({
    id: 'pandora',
    characterId: 85,
    name: 'Boxed Blessing',
    description: 'Targets the rearmost ally character on the same team.',
    color: '#9661f1',
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.REARMOST,
      }),
  }),
)
