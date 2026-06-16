import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { rowScan, RowScanDirection } from '../utils/ring'

registerSkill(
  createTileHighlightSkill({
    id: 'cassadee',
    characterId: 10,
    name: 'Tidal Strength',
    description:
      'Targets the nearest ally starting from tiles adjacent to her and expanding outwards, prioritizing characters in the back (lower hex ID for ally team, higher for enemy team).',
    tileColor: '#0288d1',
    calculateTarget: (ctx) => rowScan(ctx, ctx.team, { direction: RowScanDirection.REARMOST }),
  }),
)
