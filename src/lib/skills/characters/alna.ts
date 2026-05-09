import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { searchByRow } from '../utils/ring'

registerSkill(
  createTargetingSkill({
    id: 'alna',
    characterId: 100,
    name: 'Winter Warrior',
    description:
      'Alna targets the closest ally in the same row as herself to become the Winter Warrior. When two allies are at equal distance, the one with the higher hex ID is selected (reversed when Alna is on the enemy side).',
    color: '#4fc3f7',
    arrowType: 'ally',
    calculateTarget: (ctx) => searchByRow(ctx, ctx.team),
  }),
)
