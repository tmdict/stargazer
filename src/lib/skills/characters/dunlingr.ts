import { registerSkill } from '../registry'
import { SKILL_MODES } from '../skillModes'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

// Targets the ally on the same team furthest from Dunlingr. The arrow takes the
// colour of his Bell of Order's mode; a synergy copy holds no mode and keeps
// the default's.
registerSkill(
  createTargetingSkill({
    id: 'dunlingr',
    characterId: 57,
    color: SKILL_MODES[57]!.modes[0]!.color,
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.FURTHEST,
      }),
  }),
)
