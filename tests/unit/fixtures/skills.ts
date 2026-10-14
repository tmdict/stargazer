/**
 * Shared helpers for skill-targeting tests: direct tile placement (bypassing
 * placement rules, since targeting only reads characterId/team) and minimal
 * SkillContext construction.
 */

import type { Grid } from '@/lib/grid'
import type { SkillContext, SkillLookups, SkillManager } from '@/lib/skills/skill'
import type { Team } from '@/lib/types/team'

// For skills that read no data-store fact; spread it to answer the one a test needs.
export const NO_LOOKUPS: SkillLookups = {
  factionOf: () => undefined,
  classOf: () => undefined,
  seasonalTargeting: () => false,
}

export function placeOnTile(grid: Grid, hexId: number, characterId: number, team: Team): void {
  const tile = grid.getTileById(hexId)
  tile.characterId = characterId
  tile.team = team
}

export function removeFromTile(grid: Grid, hexId: number): void {
  const tile = grid.getTileById(hexId)
  tile.characterId = undefined
  tile.team = undefined
}

export function makeSkillContext(
  grid: Grid,
  hexId: number,
  team: Team,
  characterId: number,
): SkillContext {
  return { grid, hexId, team, characterId, skillManager: {} as SkillManager, lookups: NO_LOOKUPS }
}
