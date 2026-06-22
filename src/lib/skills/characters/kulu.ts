import { Team } from '../../types/team'
import { registerSkill } from '../registry'
import type { SkillContext, TilePaint } from '../skill'

// Cosmetic "demolition zone": paints the tiles but never changes their state, so
// they stay placeable and pathfinding ignores them.
const ZONE_COLOR = '#565b63'
const BREAKABLE_COLOR = '#a47fb8'

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

function paintZone({ skillManager, characterId, team }: SkillContext): void {
  skillManager.paintTiles(characterId, team, zoneTiles(team))
}

registerSkill({
  id: 'kulu',
  characterId: 80,
  onActivate: paintZone,
  // Repaint on update so tiles shared by both zones (22/23/24) survive one team's
  // Kulu leaving: the color channel dedupes, so the surviving Kulu must re-add them.
  onUpdate: paintZone,
  onDeactivate({ skillManager, characterId, team }: SkillContext): void {
    skillManager.clearPaintedTiles(characterId, team)
  },
})
