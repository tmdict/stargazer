import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

registerSkill(
  createTargetingSkill({
    id: 'vala',
    characterId: 46,
    name: 'Assassin',
    description:
      'Targets the enemy character on the opposing team that is furthest from the current tile of Vala.',
    color: '#9661f1',
    arrowType: 'enemy',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: getOpposingTeam(ctx.team),
        targetingMethod: TargetingMethod.FURTHEST,
      }),
  }),
)
