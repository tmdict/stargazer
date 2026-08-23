/**
 * Season 7 artifact targeting, merged into the permanent table in ../artifact.ts.
 *
 * Retirement: delete this file (and its cases in tests/unit/skills/artifact.test.ts)
 * in the same step as the season's artifact data/locale JSONs, then drop the
 * spread in ../artifact.ts that type-check flags. Retired ids restored from old
 * URLs still occupy their slot as a placeholder and would otherwise keep
 * drawing arrows.
 *
 * The ./seasonal/*.ts glob in skill.ts also imports this file; that is inert,
 * the table is consumed by explicit import.
 */
import type { ArtifactTargeting } from '../artifact'
import { frontmostUnit, rearmostUnit } from '../utils/distance'

export const SEASONAL_ARTIFACT_TARGETING: Record<number, ArtifactTargeting> = {
  // Vanguard: designates the frontmost ally as the vanguard.
  14: (grid, team) => [frontmostUnit(grid, team)],
  // Valorshield: shields the frontmost and rearmost allies.
  18: (grid, team) => [frontmostUnit(grid, team), rearmostUnit(grid, team)],
}
