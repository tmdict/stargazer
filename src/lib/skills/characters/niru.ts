import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { rowScan, ScanDirection } from '../utils/ring'

// Targets the nearest ally scanning outward from adjacent tiles, prioritizing
// characters in the back rows but taking the frontmost (higher-id) unit of a
// shared row first. Clones and summoned units are valid targets.
registerSkill(
  createTargetingSkill({
    id: 'niru',
    characterId: 28,
    color: '#98be5d',
    arrowType: 'ally',
    calculateTarget: (ctx) =>
      rowScan(ctx, {
        team: ctx.team,
        rowDirection: ScanDirection.REARMOST,
        withinRowDirection: ScanDirection.FRONTMOST,
      }),
  }),
)
