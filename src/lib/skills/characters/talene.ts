import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the frontmost ally on the same team.
registerSkill(
  createTargetingSkill({
    id: 'talene',
    characterId: 52,
    color: '#c83232',
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.FRONTMOST,
      }),
  }),
)
