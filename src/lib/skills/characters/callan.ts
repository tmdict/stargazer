import { registerSkill } from '../registry'
import type { SkillContext, SkillLine } from '../skill'
import { createLineSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { outlineEdges } from '../utils/line'

const RANGE = 2

// One outline along the zone's outer boundary rather than a border per tile.
function computeOutline(ctx: SkillContext): SkillLine[] {
  const center = ctx.grid.getHexById(ctx.hexId)
  const zone = ctx.grid
    .getAllTiles()
    .map((tile) => tile.hex)
    .filter((hex) => center.distance(hex) <= RANGE)
  return outlineEdges(zone).map(({ hex, fromCorner, toCorner }) => ({
    fromHexId: hex.getId(),
    toHexId: hex.getId(),
    fromCorner,
    toCorner,
    color: SKILL_COLORS.green,
  }))
}

// While his battle-start shield holds, Callan absorbs half of the damage taken
// by allies within a 2-tile radius; the outline traces that protection zone.
registerSkill(
  createLineSkill({
    id: 'callan',
    characterId: 70,
    calculate: computeOutline,
  }),
)
