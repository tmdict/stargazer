import { registerSkill } from '../registry'
import { createEffectsSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { zoneOutline } from '../utils/line'

// While his battle-start shield holds, Callan absorbs half of the damage taken
// by allies within a 2-tile radius; drawn as one outline along the zone's
// outer boundary, not a border per tile.
registerSkill(
  createEffectsSkill({
    id: 'callan',
    characterId: 70,
    calculate: (ctx) => ({ lines: zoneOutline(ctx.grid, ctx.hexId, 2, SKILL_COLORS.green) }),
  }),
)
