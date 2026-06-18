import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the enemy on the opposing team furthest from Vala.
registerSkill(
  createTargetingSkill({
    id: 'vala',
    characterId: 46,
    color: '#9661f1',
    arrowType: 'enemy',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: getOpposingTeam(ctx.team),
        targetingMethod: TargetingMethod.FURTHEST,
      }),
  }),
)
