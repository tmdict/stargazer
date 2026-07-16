import { isCompanionId } from '../../characters/companion'
import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { rowScan, ScanDirection } from '../utils/ring'

// Targets the nearest ally scanning outward from adjacent tiles, prioritizing
// characters in the back. Cannot target clones or summoned units.
registerSkill(
  createTargetingSkill({
    id: 'galahad',
    characterId: 99,
    color: '#e57373',
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      rowScan(ctx, {
        team: ctx.team,
        rowDirection: ScanDirection.REARMOST,
        filter: (id) => !isCompanionId(ctx.grid, id),
      }),
  }),
)
