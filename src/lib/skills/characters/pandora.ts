import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the rearmost ally on the same team.
registerSkill(
  createTargetingSkill({
    id: 'pandora',
    characterId: 85,
    color: SKILL_COLORS.purple,
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.REARMOST,
      }),
  }),
)
