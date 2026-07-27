import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the frontmost ally on the same team.
registerSkill(
  createTargetingSkill({
    id: 'isabella',
    characterId: 93,
    color: SKILL_COLORS.green,
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.FRONTMOST,
      }),
  }),
)
