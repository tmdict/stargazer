/**
 * Shared helpers for skill tests: direct tile placement (bypassing placement
 * rules, since targeting only reads characterId/team), minimal SkillContext
 * construction, and a snapshot of everything a manager holds.
 */

import type { Grid } from '@/lib/grid'
import {
  SkillManager,
  type SkillBadge,
  type SkillContext,
  type SkillLookups,
} from '@/lib/skills/skill'
import type { Team } from '@/lib/types/team'

// For skills that read no data-store fact; spread it to answer the one a test needs.
export const NO_LOOKUPS: SkillLookups = {
  factionOf: () => undefined,
  classOf: () => undefined,
  seasonalTargeting: () => false,
}

export const ID_LOOKUPS: SkillLookups = {
  ...NO_LOOKUPS,
  factionOf: (id) => ['lightbearer', 'wilder', 'graveborn', 'mauler'][id % 4],
  classOf: (id) => ['tank', 'mage', 'warrior', 'support'][id % 4],
}

export interface ManagerSnapshot {
  targets: [string, unknown][]
  images: [string, string][]
  tileColors: [number, string[]][]
  tileFills: [number, string[]][]
  lineCount: number
  badges: SkillBadge[]
}

export const skillSnapshot = (sm: SkillManager): ManagerSnapshot => ({
  targets: [...sm.getAllSkillTargets().entries()],
  images: [...sm.getImageModifiersByCharacterAndTeam().entries()],
  tileColors: [...sm.getTileColorModifiers().entries()].map(([hex, colors]) => [hex, [...colors]]),
  tileFills: [...sm.getTileFillModifiers().entries()].map(([hex, colors]) => [hex, [...colors]]),
  lineCount: sm.getSkillLines().length,
  badges: sm.getSkillBadges(),
})

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
  return {
    grid,
    hexId,
    team,
    characterId,
    skillManager: new SkillManager(NO_LOOKUPS),
    lookups: NO_LOOKUPS,
  }
}
