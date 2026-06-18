import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { rowScan, RowScanDirection } from '../utils/ring'

// Targets the nearest ally on adjacent tiles, prioritizing characters in the back
// (lower hex ID for ally, higher for enemy).
registerSkill(
  createTileHighlightSkill({
    id: 'faramor',
    characterId: 75,
    tileColor: '#6d9c86',
    calculateTarget: (ctx) =>
      rowScan(ctx, ctx.team, {
        direction: RowScanDirection.REARMOST,
        maxDistance: 1,
      }),
  }),
)
