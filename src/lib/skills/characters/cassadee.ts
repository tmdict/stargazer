import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { rowScan, ScanDirection } from '../utils/ring'

// Targets the nearest ally scanning outward from adjacent tiles, prioritizing
// characters in the back (lower hex ID for ally, higher for enemy).
registerSkill(
  createTargetingSkill({
    id: 'cassadee',
    characterId: 10,
    color: '#0288d1',
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      rowScan(ctx, { team: ctx.team, rowDirection: ScanDirection.REARMOST }),
  }),
)
