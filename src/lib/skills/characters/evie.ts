import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the rearmost ally on the same team (the ally the quill follows when the
// battle starts).
registerSkill(
  createTargetingSkill({
    id: 'evie',
    characterId: 113,
    color: '#0288d1',
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.REARMOST,
      }),
  }),
)
