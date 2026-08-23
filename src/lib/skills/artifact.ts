/* Artifact targeting: the units an artifact in a team's slot acts on, drawn as
 * arrows from the slot's host cell.
 *
 * Not a Skill: a Skill is owned by a placed unit and lives with its placement,
 * while an artifact is owned by board-level slot state and has no hex for the
 * lifecycle to track. So each board derives these arrows from the slot and the
 * grid (useGridContext.artifactArrows), the way the closest-target arrows are
 * derived, and they re-evaluate with every placement change.
 */

import { artifactHostHex, type Grid } from '../grid'
import type { Hex } from '../hex'
import type { Team } from '../types/team'
import { SEASONAL_ARTIFACT_TARGETING } from './seasonal/artifact'
import { rearmostUnit } from './utils/distance'
import type { TargetCandidate } from './utils/targeting'

// The units the artifact acts on, given the team whose slot holds it; a null
// pick is a rule that found no unit.
export type ArtifactTargeting = (grid: Grid, team: Team) => (TargetCandidate | null)[]

export interface ArtifactArrow {
  team: Team
  fromHex: Hex
  toHex: Hex
}

// Keyed by artifact id (src/data/artifact, src/data/seasonal/artifact).
const ARTIFACT_TARGETING: Record<number, ArtifactTargeting> = {
  // Enlightening: buffs the rearmost ally.
  3: (grid, team) => [rearmostUnit(grid, team)],
  ...SEASONAL_ARTIFACT_TARGETING,
}

export function artifactTargetArrows(
  grid: Grid,
  team: Team,
  artifactId: number | null,
): ArtifactArrow[] {
  const targeting = artifactId === null ? undefined : ARTIFACT_TARGETING[artifactId]
  if (!targeting) return []
  const fromHex = artifactHostHex(grid, team)
  // Distinct hexes: a lone unit is both the frontmost and the rearmost pick.
  const hexIds = new Set(targeting(grid, team).flatMap((pick) => (pick ? [pick.hexId] : [])))
  return [...hexIds].map((hexId) => ({ team, fromHex, toHex: grid.getHexById(hexId) }))
}
