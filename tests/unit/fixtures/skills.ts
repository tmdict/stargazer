/**
 * Shared helpers for skill-targeting tests: direct tile placement (bypassing
 * placement rules, since targeting only reads characterId/team) and minimal
 * SkillContext construction.
 */

import type { Grid } from '@/lib/grid'
import type { SkillContext, SkillManager } from '@/lib/skills/skill'
import type { Team } from '@/lib/types/team'

export function placeOnTile(grid: Grid, hexId: number, characterId: number, team: Team): void {
  const tile = grid.getTileById(hexId)
  tile.characterId = characterId
  tile.team = team
}

export function makeSkillContext(
  grid: Grid,
  hexId: number,
  team: Team,
  characterId: number,
): SkillContext {
  return { grid, hexId, team, characterId, skillManager: {} as SkillManager }
}
