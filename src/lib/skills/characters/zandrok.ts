import type { Hex } from '../../hex'
import { registerSkill } from '../registry'
import type { SkillContext, SkillLine } from '../skill'
import { withSkillLine } from '../utils/builders'
import { laneSpan } from '../utils/line'

const ZANDROK = 88
const SKILL_COLOR = '#e57373'

// At battle start, illusions of Zandrok charge in a 5-tile-wide wedge along his
// s-axis lane. The visual is the band's two boundary lines: the lanes s = s_z +/- 2
// (5 lanes total), each drawn along its outer edge.
const WEDGE_HALF_WIDTH = 2
// Outer corner of a constant-s lane (pointy-top corner indices, see
// Layout.hexCornerOffset): corner 3 (upper-left) faces +s, corner 0 (lower-right) -s.
const HIGH_CORNER = 3
const LOW_CORNER = 0

// The band's boundary line on lane `s` (corner to corner across the lane), or null when
// the lane is too short to span.
function laneEdge(hexes: Hex[], s: number, corner: number): SkillLine | null {
  const span = laneSpan(hexes, s)
  if (!span) return null
  return {
    fromHexId: span[0].getId(),
    toHexId: span[1].getId(),
    fromCorner: corner,
    toCorner: corner,
    color: SKILL_COLOR,
  }
}

export function wedgeLines(ctx: SkillContext): SkillLine[] {
  const hexes = ctx.grid.getAllTiles().map((tile) => tile.hex)
  const s = ctx.grid.getHexById(ctx.hexId).s
  // Clamp the band's outer lanes to the grid's s-range, so a wedge that runs off an
  // edge draws along the boundary cells instead of vanishing.
  const allS = hexes.map((hex) => hex.s)
  const maxS = Math.max(...allS)
  const minS = Math.min(...allS)
  return [
    laneEdge(hexes, Math.min(s + WEDGE_HALF_WIDTH, maxS), HIGH_CORNER),
    laneEdge(hexes, Math.max(s - WEDGE_HALF_WIDTH, minS), LOW_CORNER),
  ].filter((line): line is SkillLine => line !== null)
}

// No targeting or companions: the wedge lines are the whole skill, so it decorates a
// bare base.
registerSkill(
  withSkillLine(
    { id: 'zandrok', characterId: ZANDROK, onActivate() {}, onDeactivate() {} },
    wedgeLines,
  ),
)
