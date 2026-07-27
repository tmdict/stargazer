import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the ally on the same team furthest from Dunlingr.
registerSkill(
  createTargetingSkill({
    id: 'dunlingr',
    characterId: 57,
    color: SKILL_COLORS.amber,
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.FURTHEST,
      }),
  }),
)
