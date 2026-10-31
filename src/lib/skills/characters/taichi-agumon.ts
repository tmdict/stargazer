import { Team } from '../../types/team'
import { registerSkill } from '../registry'
import type { SkillContext, SkillLine } from '../skill'
import { createEffectsSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { zoneBoundary } from '../utils/line'

// When a battle starts, the awakening strengthens every ally behind Taichi &
// Agumon, across the whole board. Behind is any diagonal row (q - r) further
// back than theirs, so an ally level with them is not behind. Drawn as the one
// line where behind starts, along the tile edges, since a row overlaps the row
// behind it and a straight line would cut tiles in two.
function behindLine(ctx: SkillContext): SkillLine[] {
  const row = ctx.grid.getHexById(ctx.hexId).getDiagonal()
  const behind = ctx.grid
    .getAllTiles()
    .map((tile) => tile.hex)
    .filter((hex) => (ctx.team === Team.ALLY ? hex.getDiagonal() < row : hex.getDiagonal() > row))
  return zoneBoundary(ctx.grid, behind, SKILL_COLORS.amber)
}

registerSkill(
  createEffectsSkill({
    id: 'taichi-agumon',
    characterId: 123,
    calculate: (ctx) => ({ lines: behindLine(ctx) }),
  }),
)
