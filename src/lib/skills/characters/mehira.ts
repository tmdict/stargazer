import { registerSkill } from '../registry'
import { createEffectsSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { getSymmetricalHexId } from '../utils/symmetry'

// Outlines the tile where Mehira's illusion appears when a battle starts: the
// tile symmetrical to hers, the same mirror Evie and Silvina use, wherever it
// falls and whoever stands on it.
registerSkill(
  createEffectsSkill({
    id: 'mehira',
    characterId: 94,
    calculate: (ctx) => {
      const mirrorId = getSymmetricalHexId(ctx.grid, ctx.hexId)
      return {
        tiles: mirrorId === undefined ? [] : [{ hexId: mirrorId, color: SKILL_COLORS.orchid }],
      }
    },
  }),
)
