import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { rowScan, ScanDirection } from '../utils/ring'

// Protects the frontmost ally on adjacent tiles, prioritizing characters in the
// front (higher hex ID for ally, lower for enemy).
registerSkill(
  createTileHighlightSkill({
    id: 'hepler',
    characterId: 110,
    tileColor: SKILL_COLORS.red,
    calculateTarget: (ctx) =>
      rowScan(ctx, {
        team: ctx.team,
        rowDirection: ScanDirection.FRONTMOST,
        maxDistance: 1,
      }),
  }),
)
