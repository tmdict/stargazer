import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { searchByRow } from '../utils/ring'

// Targets the closest ally in the same row. On a distance tie, the higher hex ID
// wins (reversed when Alna is on the enemy side).
registerSkill(
  createTargetingSkill({
    id: 'alna',
    characterId: 100,
    color: '#7badc4',
    arrowType: 'ally',
    calculateTarget: (ctx) => searchByRow(ctx, ctx.team),
  }),
)
