import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { rowScan, RowScanDirection } from '../utils/ring'

registerSkill(
  createTileHighlightSkill({
    id: 'faramor',
    characterId: 75,
    name: 'Sacred Pledge',
    description:
      'Targets the nearest ally on tiles adjacent to him, prioritizing characters in the back (lower hex ID for ally team, higher for enemy team).',
    tileColor: '#6d9c86',
    calculateTarget: (ctx) =>
      rowScan(ctx, ctx.team, {
        direction: RowScanDirection.REARMOST,
        maxDistance: 1,
      }),
  }),
)
