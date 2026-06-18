import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the rearmost ally on the same team.
registerSkill(
  createTargetingSkill({
    id: 'pandora',
    characterId: 85,
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
