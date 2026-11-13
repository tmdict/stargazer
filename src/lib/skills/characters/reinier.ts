import { getOpposingTeam } from '../../characters/character'
import { Team } from '../../types/team'
import { registerSkill } from '../registry'
import type { SkillContext, SkillTargetInfo, TilePaint } from '../skill'
import { createTargetingSkill, withEffects } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { getSymmetricalHexId } from '../utils/symmetry'

const TILE_COLOR = SKILL_COLORS.purple

// Which neighbour is tried first. Positions run clockwise from top-right (0) to
// top-left (5); the ally team starts at bottom-left, and the enemy team's order
// is the same turned 180 degrees. The order alternates sides, so the shared
// row scan does not fit.
const NEIGHBOUR_ORDER: Record<Team, number[]> = {
  [Team.ALLY]: [3, 4, 2, 1, 5, 0],
  [Team.ENEMY]: [0, 5, 1, 2, 4, 3],
}

// The first adjacent ally, in neighbour order, whose symmetrical tile holds an
// enemy. The target carries the pair for the Debug tab.
function calculateTarget({ grid, hexId, team }: SkillContext): SkillTargetInfo | null {
  const neighbors = grid.getHexById(hexId).getNeighbors()
  const enemyTeam = getOpposingTeam(team)

  for (const position of NEIGHBOUR_ORDER[team]) {
    // Off-grid neighbors are expected for edge hexes
    const ally = grid.getTileOrUndefined(neighbors[position]!)
    if (!ally?.characterId || ally.team !== team) continue

    const allyHexId = ally.hex.getId()
    const enemyHexId = getSymmetricalHexId(grid, allyHexId)
    if (!enemyHexId) continue

    const mirror = grid.getTileById(enemyHexId)
    if (mirror.characterId && mirror.team === enemyTeam) {
      return {
        targetHexId: allyHexId,
        targetCharacterId: null,
        metadata: { allyHexId, enemyHexId },
      }
    }
  }

  return null
}

const bothChannels = (hexId: number): TilePaint[] => [
  { hexId, color: TILE_COLOR },
  { hexId, color: TILE_COLOR, fill: true },
]

// Paints the ally and enemy of the pair the targeting half just stored.
registerSkill(
  withEffects(createTargetingSkill({ id: 'reinier', characterId: 31, calculateTarget }), (ctx) => {
    const pair = ctx.skillManager.getSkillTarget(ctx.characterId, ctx.team)?.metadata
    const tiles =
      pair?.allyHexId && pair.enemyHexId
        ? [...bothChannels(pair.allyHexId), ...bothChannels(pair.enemyHexId)]
        : []
    return { tiles }
  }),
)
