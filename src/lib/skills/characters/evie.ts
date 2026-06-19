import { getTeamFromTileState } from '../../../utils/tileStateFormatting'
import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import type { SkillContext, TilePaint } from '../skill'
import { createTargetingSkill, withTilePaint } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'
import { getSymmetricalHexId } from '../utils/symmetry'

const TILE_COLOR = '#0288d1'

// Outlines the tile symmetrical to Evie (across the board centre, as Silvina
// targets) and its six neighbours, keeping only those in the opposing team's zone
// (occupied or not).
function computeHighlights(ctx: SkillContext): TilePaint[] {
  const symId = getSymmetricalHexId(ctx.grid, ctx.hexId)
  if (symId === undefined) return []

  const opposingTeam = getOpposingTeam(ctx.team)
  const symHex = ctx.grid.getHexById(symId)

  const tiles: TilePaint[] = []
  for (const hex of [symHex, ...symHex.getNeighbors()]) {
    const tile = ctx.grid.getTileOrUndefined(hex)
    if (tile && getTeamFromTileState(tile.state) === opposingTeam) {
      tiles.push({ hexId: tile.hex.getId(), color: TILE_COLOR })
    }
  }
  return tiles
}

// Targets the rearmost ally on the same team (the ally the quill follows when the
// battle starts), and outlines the enemy-zone tiles around her symmetrical cell.
registerSkill(
  withTilePaint(
    createTargetingSkill({
      id: 'evie',
      characterId: 113,
      color: TILE_COLOR,
      arrowType: 'ally',
      calculateTarget: (ctx) =>
        findTarget(ctx, {
          targetTeam: ctx.team,
          excludeSelf: true,
          targetingMethod: TargetingMethod.REARMOST,
        }),
    }),
    computeHighlights,
  ),
)
