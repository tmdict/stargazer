import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { rowScan, ScanDirection } from '../utils/ring'

// Targets the nearest ally on adjacent tiles, prioritizing characters in the back
// (lower hex ID for ally, higher for enemy).
registerSkill(
  createTileHighlightSkill({
    id: 'faramor',
    characterId: 75,
    tileColor: SKILL_COLORS.teal,
    calculateTarget: (ctx) =>
      rowScan(ctx, {
        team: ctx.team,
        rowDirection: ScanDirection.REARMOST,
        maxDistance: 1,
      }),
  }),
)
