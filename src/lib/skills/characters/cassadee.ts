import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { rowScan, ScanDirection } from '../utils/ring'

// Targets the nearest ally scanning outward from adjacent tiles, prioritizing
// characters in the back (lower hex ID for ally, higher for enemy).
registerSkill(
  createTargetingSkill({
    id: 'cassadee',
    characterId: 10,
    color: SKILL_COLORS.blue,
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      rowScan(ctx, { team: ctx.team, rowDirection: ScanDirection.REARMOST }),
  }),
)
