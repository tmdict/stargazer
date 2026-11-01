import type { Hex } from '../../hex'
import { Team } from '../../types/team'
import { registerSkill } from '../registry'
import type { SkillContext } from '../skill'
import { createEffectsSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { zoneBoundary } from '../utils/line'

// When a battle starts, the awakening strengthens every ally behind Taichi &
// Agumon, across the whole board. Behind is any diagonal row (q - r) further
// back than theirs, so an ally level with them is not behind. Drawn as the one
// line where behind starts, along the tile edges, since a row overlaps the row
// behind it and a straight line would cut tiles in two.
function behind(ctx: SkillContext): Hex[] {
  const row = ctx.grid.getHexById(ctx.hexId).getDiagonal()
  return ctx.grid
    .getAllTiles()
    .map((tile) => tile.hex)
    .filter((hex) => (ctx.team === Team.ALLY ? hex.getDiagonal() < row : hex.getDiagonal() > row))
}

registerSkill(
  createEffectsSkill({
    id: 'taichi-agumon',
    characterId: 123,
    calculate: (ctx) => {
      const zone = behind(ctx)
      return {
        lines: zoneBoundary(ctx.grid, zone, SKILL_COLORS.amber),
        zone: zone.map((hex) => hex.getId()),
      }
    },
  }),
)
