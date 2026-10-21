/* Artifact targeting: the units an artifact in a team's slot acts on, drawn as
 * arrows from the slot's host cell. An artifact draws exactly when it has an
 * entry here, so adding its mechanic turns it on.
 *
 * Not a Skill: a Skill is owned by a placed unit and lives with its placement,
 * while an artifact is owned by board-level slot state and has no hex for the
 * lifecycle to track. So each board derives these arrows from the slot and the
 * grid (useGridContext.artifactArrows), the way the closest-target arrows are
 * derived, and they re-evaluate with every placement change.
 */

import { getOpposingTeam } from '../characters/character'
import { artifactHostHex, type Grid } from '../grid'
import type { Hex } from '../hex'
import type { Team } from '../types/team'
import { frontmostUnit, frontmostUnits, rearmostUnit } from './utils/distance'
import type { TargetCandidate } from './utils/targeting'

// The units the artifact acts on, on either team, given the team whose slot
// holds it; a null pick is a rule that found no unit.
type ArtifactTargeting = (grid: Grid, team: Team) => (TargetCandidate | null)[]

export interface ArtifactArrow {
  team: Team
  fromHex: Hex
  toHex: Hex
}

// Keyed by artifact name (src/data/artifact, src/data/seasonal/artifact).
// Seasonal ids are reused, so a rule left behind at a cutover matches no
// artifact instead of drawing for the next season's artifact under the same id.
const ARTIFACT_TARGETING = new Map<string, ArtifactTargeting>([
  // Enlightening: buffs the rearmost ally.
  ['enlightening', (grid, team) => [rearmostUnit(grid, team)]],

  /* Seasonal entries go below under a season comment, deleted (with the
   * season's cases in tests/unit/skills/artifact.test.ts) along with the
   * season's artifact data files. Only base-level targets are drawn, not the
   * extra ones an upgrade adds (Coreforge's level-7 second sigil). */

  // Season 8.
  // Candleflame: a flame follows the frontmost ally from the start of battle.
  ['candleflame', (grid, team) => [frontmostUnit(grid, team)]],
  // Soulshock: stuns the two frontmost enemies.
  ['soulshock', (grid, team) => frontmostUnits(grid, getOpposingTeam(team), 2)],
  // Thundermight: chain lightning at the frontmost and rearmost enemies.
  [
    'thundermight',
    (grid, team) => {
      const enemy = getOpposingTeam(team)
      return [frontmostUnit(grid, enemy), rearmostUnit(grid, enemy)]
    },
  ],
  // Bladesummon: portal swords strike the frontmost enemy.
  ['bladesummon', (grid, team) => [frontmostUnit(grid, getOpposingTeam(team))]],
  // Soulbound: links the frontmost and rearmost allies.
  ['soulbound', (grid, team) => [frontmostUnit(grid, team), rearmostUnit(grid, team)]],
  // Coreforge: a sigil beneath the rearmost ally.
  ['coreforge', (grid, team) => [rearmostUnit(grid, team)]],
])

export function artifactTargetArrows(
  grid: Grid,
  team: Team,
  artifactName: string | undefined,
): ArtifactArrow[] {
  const rule = artifactName === undefined ? undefined : ARTIFACT_TARGETING.get(artifactName)
  if (!rule) return []
  const fromHex = artifactHostHex(grid, team)
  // Distinct hexes: a lone unit is both the frontmost and the rearmost pick.
  const hexIds = new Set(rule(grid, team).flatMap((pick) => (pick ? [pick.hexId] : [])))
  return [...hexIds].map((hexId) => ({ team, fromHex, toHex: grid.getHexById(hexId) }))
}
