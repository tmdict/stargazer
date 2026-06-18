import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { rowScan, RowScanDirection } from '../utils/ring'

// Targets the nearest ally scanning outward from adjacent tiles, prioritizing
// characters in the back (lower hex ID for ally, higher for enemy).
registerSkill(
  createTileHighlightSkill({
    id: 'cassadee',
    characterId: 10,
    tileColor: '#0288d1',
    calculateTarget: (ctx) => rowScan(ctx, ctx.team, { direction: RowScanDirection.REARMOST }),
  }),
)
