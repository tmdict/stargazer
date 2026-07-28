import { registerSkill } from '../registry'
import { createLineSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { zoneOutline } from '../utils/line'

// Grants Sparks to allies within 2 tiles when a battle starts; drawn as one
// outline along the zone's outer boundary, not a border per tile.
registerSkill(
  createLineSkill({
    id: 'satrana',
    characterId: 35,
    calculate: (ctx) => zoneOutline(ctx.grid, ctx.hexId, 2, SKILL_COLORS.red),
  }),
)
