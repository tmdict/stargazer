import { registerSkill } from '../registry'
import { createEffectsSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { tilesWithin, zoneOutline } from '../utils/line'

// While his battle-start shield holds, Callan absorbs half of the damage taken
// by allies within a 2-tile radius; drawn as one outline along the zone's
// outer boundary, not a border per tile.
registerSkill(
  createEffectsSkill({
    id: 'callan',
    characterId: 70,
    calculate: ({ grid, hexId }) => {
      const zone = tilesWithin(grid, hexId, 2)
      return { lines: zoneOutline(zone, SKILL_COLORS.green), zone: zone.map((hex) => hex.getId()) }
    },
  }),
)
