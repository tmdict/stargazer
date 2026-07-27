import { registerSkill } from '../registry'
import type { SkillContext, TilePaint } from '../skill'
import { createTilePaintSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { getCandidates } from '../utils/targeting'

function computeHighlights(ctx: SkillContext): TilePaint[] {
  const center = ctx.grid.getHexById(ctx.hexId)
  return getCandidates(ctx.grid, ctx.team, ctx.characterId)
    .filter((c) => center.distance(ctx.grid.getHexById(c.hexId)) <= 2)
    .map((c) => ({ hexId: c.hexId, color: SKILL_COLORS.red, fill: true }))
}

// Grants Sparks to allies within 2 tiles when a battle starts; the tile of
// every same-team unit in range (summons included) is tinted.
registerSkill(
  createTilePaintSkill({
    id: 'satrana',
    characterId: 35,
    calculate: computeHighlights,
  }),
)
