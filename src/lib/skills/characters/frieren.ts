import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the frontmost ally on the same team.
registerSkill(
  createTargetingSkill({
    id: 'frieren',
    characterId: 111,
    color: '#b0a8d0',
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.FRONTMOST,
      }),
  }),
)
