import type { Grid } from '../../grid'
import { Team } from '../../types/team'
import type { SkillContext, SkillTargetInfo } from '../skill'
import {
  calculateDistances,
  getCandidates,
  getTeamTargetCandidates,
  type TargetCandidate,
} from './targeting'

/**
 * Distance-based targeting
 */

export enum TargetingMethod {
  CLOSEST,
  FURTHEST,
  REARMOST, // Scans hex IDs based on team: ally scans 45→1, enemy scans 1→45
  FRONTMOST, // Scans hex IDs based on team: ally scans 1→45, enemy scans 45→1
}

export interface TargetingOptions {
  targetTeam: Team
  excludeSelf?: boolean
  targetingMethod: TargetingMethod
  referenceHexId?: number // Default to context.hexId
}

/**
 * Sort candidates by targeting method (closest/furthest)
 */
function sortByTargetingMethod(
  candidates: TargetCandidate[],
  referenceHexId: number,
  targetingMethod: TargetingMethod,
): TargetCandidate[] {
  return [...candidates].sort((a, b) => {
    const distA = a.distances.get(referenceHexId) ?? 0
    const distB = b.distances.get(referenceHexId) ?? 0

    if (targetingMethod === TargetingMethod.FURTHEST) {
      return distB - distA
    } else {
      return distA - distB
    }
  })
}

/**
 * Apply team-aware hex ID tie-breaking when multiple candidates are at the same distance
 * - Ally team prefers lower hex IDs
 * - Enemy team prefers higher hex IDs (180° rotation symmetry)
 */
function applyHexIdTieBreaker(
  sortedCandidates: TargetCandidate[],
  casterTeam: Team,
  referenceHexId: number,
): TargetCandidate | null {
  if (sortedCandidates.length === 0) return null

  const firstCandidate = sortedCandidates[0]
  if (!firstCandidate) {
    console.warn('targeting: First candidate is undefined in resolveTies', {
      sortedCandidatesLength: sortedCandidates.length,
    })
    return null
  }
  const bestDistance = firstCandidate.distances.get(referenceHexId) ?? 0
  const tiedCandidates = sortedCandidates.filter(
    (c) => (c.distances.get(referenceHexId) ?? 0) === bestDistance,
  )

  if (tiedCandidates.length === 1) {
    const first = tiedCandidates[0]
    return first ?? null
  }

  const sorted = tiedCandidates.sort((a, b) => {
    if (casterTeam === Team.ALLY) {
      return a.hexId - b.hexId
    } else {
      return b.hexId - a.hexId
    }
  })
  return sorted[0] ?? null
}

/**
 * Main targeting function that handles all common cases
 */
export function findTarget(
  context: SkillContext,
  options: TargetingOptions,
): SkillTargetInfo | null {
  // Handle special targeting methods that don't use distance-based sorting
  if (options.targetingMethod === TargetingMethod.REARMOST) {
    return findRearmostTarget(context, options.targetTeam, options.excludeSelf ?? false)
  }

  if (options.targetingMethod === TargetingMethod.FRONTMOST) {
    return findFrontmostTarget(context, options.targetTeam)
  }

  const { grid, team, hexId, characterId } = context
  const referenceHexId = options.referenceHexId ?? hexId

  const candidates = getCandidates(
    grid,
    options.targetTeam,
    options.excludeSelf ? characterId : undefined,
  )

  if (candidates.length === 0) return null

  calculateDistances(candidates, [referenceHexId], grid)

  const sorted = sortByTargetingMethod(candidates, referenceHexId, options.targetingMethod)
  const winner = applyHexIdTieBreaker(sorted, team, referenceHexId)

  if (!winner) return null

  // Track examined tiles for debugging
  const examinedTiles = candidates.map((c) => c.hexId)

  return {
    targetHexId: winner.hexId,
    targetCharacterId: winner.characterId,
    metadata: {
      sourceHexId: hexId,
      distance: winner.distances.get(referenceHexId),
      examinedTiles,
    },
  }
}

/**
 * Formation ends by hex id. Ids run from a team's back to its front (ally ids
 * rise toward the enemy side, enemy ids fall toward the ally side), so the
 * frontmost unit of a team is its highest id for allies and lowest for enemies,
 * and the rearmost is the opposite end. The end is a property of the targeted
 * team, independent of who is asking (a caster, or an artifact with no hex).
 */
function extremeByHexId(candidates: TargetCandidate[], highest: boolean): TargetCandidate | null {
  if (candidates.length === 0) return null
  return candidates.reduce((best, current) =>
    (highest ? current.hexId > best.hexId : current.hexId < best.hexId) ? current : best,
  )
}

function frontmostCandidate(
  candidates: TargetCandidate[],
  targetTeam: Team,
): TargetCandidate | null {
  return extremeByHexId(candidates, targetTeam === Team.ALLY)
}

function rearmostCandidate(
  candidates: TargetCandidate[],
  targetTeam: Team,
): TargetCandidate | null {
  return extremeByHexId(candidates, targetTeam === Team.ENEMY)
}

// Whole-team picks for callers without a caster (artifact targeting).
export function frontmostUnit(grid: Grid, team: Team): TargetCandidate | null {
  return frontmostCandidate(getTeamTargetCandidates(grid, team), team)
}

export function rearmostUnit(grid: Grid, team: Team): TargetCandidate | null {
  return rearmostCandidate(getTeamTargetCandidates(grid, team), team)
}

/**
 * Find the rearmost target of `targetTeam`. `excludeSelf` drops the caster when
 * it targets its own team.
 */
export function findRearmostTarget(
  context: SkillContext,
  targetTeam: Team,
  excludeSelf: boolean = false,
): SkillTargetInfo | null {
  const { grid, team, hexId, characterId } = context

  const candidates = getCandidates(
    grid,
    targetTeam,
    excludeSelf && targetTeam === team ? characterId : undefined,
  )
  const winner = rearmostCandidate(candidates, targetTeam)
  if (!winner) return null

  return {
    targetHexId: winner.hexId,
    targetCharacterId: winner.characterId,
    metadata: {
      sourceHexId: hexId,
      examinedTiles: candidates.map((c) => c.hexId),
      isRearmostTarget: true,
    },
  }
}

/**
 * Find the frontmost target of `targetTeam`. Always excludes the caster when it
 * targets its own team.
 */
export function findFrontmostTarget(
  context: SkillContext,
  targetTeam: Team,
): SkillTargetInfo | null {
  const { grid, team, hexId, characterId } = context

  const candidates = getCandidates(grid, targetTeam, targetTeam === team ? characterId : undefined)
  const winner = frontmostCandidate(candidates, targetTeam)
  if (!winner) return null

  return {
    targetHexId: winner.hexId,
    targetCharacterId: winner.characterId,
    metadata: {
      sourceHexId: hexId,
      examinedTiles: candidates.map((c) => c.hexId),
      isFrontmostTarget: true,
    },
  }
}
