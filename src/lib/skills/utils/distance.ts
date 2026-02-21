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
      return distB - distA // Furthest first
    } else {
      return distA - distB // Closest first
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

  // Get all candidates at the best distance
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

  // Apply team-aware hex ID tie-breaking
  const sorted = tiedCandidates.sort((a, b) => {
    if (casterTeam === Team.ALLY) {
      return a.hexId - b.hexId // Lower hex ID wins for ally team
    } else {
      return b.hexId - a.hexId // Higher hex ID wins for enemy team
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

  // Get candidates based on target team
  const candidates = getCandidates(
    grid,
    options.targetTeam,
    options.excludeSelf ? characterId : undefined,
  )

  if (candidates.length === 0) return null

  // Calculate distances
  calculateDistances(candidates, [referenceHexId], grid)

  // Sort by targeting method (closest/furthest)
  const sorted = sortByTargetingMethod(candidates, referenceHexId, options.targetingMethod)

  // Apply team-aware hex ID tie-breaking
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
 * Find the rearmost target based on hex ID positions.
 *
 * Rearmost is determined by the target team's position in the grid:
 * - When targeting enemies (regardless of caster): largest hex ID is rearmost
 * - When targeting allies (regardless of caster): smallest hex ID is rearmost
 *
 * This ensures consistent behavior whether it's:
 * - Ally targeting rearmost enemy
 * - Ally targeting rearmost ally
 * - An enemy targeting rearmost ally or enemy
 */
export function findRearmostTarget(
  context: SkillContext,
  targetTeam: Team,
  excludeSelf: boolean = false,
): SkillTargetInfo | null {
  const { grid, team, hexId, characterId } = context

  // Get all candidates on the target team
  let candidates = getTeamTargetCandidates(grid, targetTeam)

  // Exclude self if requested and targeting the same team
  if (excludeSelf && targetTeam === team) {
    candidates = candidates.filter((c) => c.characterId !== characterId)
  }

  if (candidates.length === 0) return null

  // Optimize by finding max/min hex ID directly instead of scanning all tiles
  // The logic is based on which team we're TARGETING, not which team is casting
  let rearmostCandidate: TargetCandidate
  if (targetTeam === Team.ENEMY) {
    // Targeting enemies: largest hex ID is rearmost (furthest from allies)
    rearmostCandidate = candidates.reduce((max, current) =>
      current.hexId > max.hexId ? current : max,
    )
  } else {
    // Targeting allies: smallest hex ID is rearmost (furthest from enemies)
    rearmostCandidate = candidates.reduce((min, current) =>
      current.hexId < min.hexId ? current : min,
    )
  }

  return {
    targetHexId: rearmostCandidate.hexId,
    targetCharacterId: rearmostCandidate.characterId,
    metadata: {
      sourceHexId: hexId,
      examinedTiles: candidates.map((c) => c.hexId),
      isRearmostTarget: true,
    },
  }
}

/**
 * Find the frontmost target based on hex ID positions.
 *
 * Frontmost is determined by the target team's position in the grid:
 * - When targeting enemies (regardless of caster): smallest hex ID is frontmost
 * - When targeting allies (regardless of caster): largest hex ID is frontmost
 *
 * This is the opposite of rearmost targeting - it finds characters at the "front"
 * of their formation. Always excludes self when targeting the same team.
 */
export function findFrontmostTarget(
  context: SkillContext,
  targetTeam: Team,
): SkillTargetInfo | null {
  const { grid, team, hexId, characterId } = context

  // Get all candidates on the target team, excluding self if targeting same team
  let candidates = getTeamTargetCandidates(grid, targetTeam)

  // Always exclude self when targeting the same team
  if (targetTeam === team) {
    candidates = candidates.filter((c) => c.characterId !== characterId)
  }

  if (candidates.length === 0) return null

  // Find frontmost based on which team we're TARGETING, not which team is casting
  let frontmostCandidate: TargetCandidate
  if (targetTeam === Team.ENEMY) {
    // Targeting enemies: smallest hex ID is frontmost (closest to allies)
    frontmostCandidate = candidates.reduce((min, current) =>
      current.hexId < min.hexId ? current : min,
    )
  } else {
    // Targeting allies: largest hex ID is frontmost (closest to enemies)
    frontmostCandidate = candidates.reduce((max, current) =>
      current.hexId > max.hexId ? current : max,
    )
  }

  return {
    targetHexId: frontmostCandidate.hexId,
    targetCharacterId: frontmostCandidate.characterId,
    metadata: {
      sourceHexId: hexId,
      examinedTiles: candidates.map((c) => c.hexId),
      isFrontmostTarget: true,
    },
  }
}
