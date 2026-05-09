import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { rowScan, RowScanDirection } from '../utils/ring'

registerSkill(
  createTileHighlightSkill({
    id: 'galahad',
    characterId: 99,
    name: 'Time Recast',
    description:
      'Targets the nearest ally starting from tiles adjacent to her and expanding outwards, prioritizing characters in the back. Cannot target clones or summoned units.',
    tileColor: '#e57373',
    calculateTarget: (ctx) =>
      rowScan(ctx, ctx.team, {
        direction: RowScanDirection.REARMOST,
        excludeCompanions: true,
      }),
  }),
)
