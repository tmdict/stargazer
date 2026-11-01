import { registerSkill } from '../registry'
import { createEffectsSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { tilesWithin, zoneOutline } from '../utils/line'

// Grants Sparks to allies within 2 tiles when a battle starts; drawn as one
// outline along the zone's outer boundary, not a border per tile.
registerSkill(
  createEffectsSkill({
    id: 'satrana',
    characterId: 35,
    calculate: ({ grid, hexId }) => {
      const zone = tilesWithin(grid, hexId, 2)
      return { lines: zoneOutline(zone, SKILL_COLORS.red), zone: zone.map((hex) => hex.getId()) }
    },
  }),
)
