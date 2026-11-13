import { Team } from '../../types/team'
import { registerSkill } from '../registry'
import type { TilePaint } from '../skill'
import { createEffectsSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'

// Cosmetic "demolition zone": paints the tiles but never changes their state, so
// they stay placeable and pathfinding ignores them.
const ZONE_COLOR = SKILL_COLORS.slate
const BREAKABLE_COLOR = SKILL_COLORS.orchid

const ALLY_AFFECTED = { blocked: [18, 19, 20, 21, 22, 24], breakable: [23] }
const ENEMY_AFFECTED = { blocked: [25, 26, 27, 28, 22, 24], breakable: [23] }

function zoneTiles(team: Team): TilePaint[] {
  const config = team === Team.ALLY ? ALLY_AFFECTED : ENEMY_AFFECTED
  const paint = (hexId: number, color: string): TilePaint[] => [
    { hexId, color },
    { hexId, color, fill: true },
  ]
  return [
    ...config.blocked.flatMap((id) => paint(id, ZONE_COLOR)),
    ...config.breakable.flatMap((id) => paint(id, BREAKABLE_COLOR)),
  ]
}

// Tiles shared by both zones (22/23/24) survive one team's Kulu leaving through
// the paint channels' per-color refcounts.
registerSkill(
  createEffectsSkill({
    id: 'kulu',
    characterId: 80,
    calculate: ({ team }) => ({ tiles: zoneTiles(team) }),
  }),
)
