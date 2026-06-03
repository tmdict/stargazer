import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

registerSkill(
  createTargetingSkill({
    id: 'evie',
    characterId: 113,
    name: 'Foretold Favor',
    description:
      'Targets the rearmost ally on the same team, the ally the quill follows when the battle starts.',
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
