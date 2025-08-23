import type { Grid } from '../../grid'
import type { SkillContext, SkillTargetInfo } from '../../skill'
import { Team } from '../../types/team'

export interface TargetCandidate {
  hexId: number
  characterId: number
  distances: Map<number, number> // hexId -> distance
}

export enum TargetingMethod {
  CLOSEST,
  FURTHEST,
}

export enum TieBreaker {
  HEX_ID, // Team-aware hex ID
  SPIRAL, // Team-aware spiral walk
}

export interface TargetingOptions {
  targetTeam: Team
  excludeSelf?: boolean
  targetingMethod: TargetingMethod
  tieBreaker: TieBreaker
  referenceHexId?: number // Default to context.hexId
}

/**
 * Get all characters for a given team
 */
export function getTeamCharacters(grid: Grid, team: Team): TargetCandidate[] {
  const characters: TargetCandidate[] = []

  // Use Grid's optimized getTilesWithCharacters() instead of getAllTiles()
  const tilesWithCharacters = grid.getTilesWithCharacters()

  for (const tile of tilesWithCharacters) {
    if (tile.team === team) {
      characters.push({
        hexId: tile.hex.getId(),
        characterId: tile.characterId!,
        distances: new Map(),
      })
    }
  }

  return characters
}

/**
 * Get all opposing team characters for a given team
 */
export function getOpposingCharacters(grid: Grid, team: Team): TargetCandidate[] {
  const opposingTeam = team === Team.ALLY ? Team.ENEMY : Team.ALLY
  return getTeamCharacters(grid, opposingTeam)
}

/**
 * Calculate distances from multiple reference points efficiently
 */
export function calculateDistances(
  candidates: TargetCandidate[],
  referenceHexIds: number[],
  grid: Grid,
): void {
  for (const refHexId of referenceHexIds) {
    const refHex = grid.getHexById(refHexId)

    for (const candidate of candidates) {
      const candidateHex = grid.getHexById(candidate.hexId)
      const distance = refHex.distance(candidateHex)
      candidate.distances.set(refHexId, distance)
    }
  }
}

/**
 * Helper function to get the opposing team
 */
export function getOpposingTeam(team: Team): Team {
  return team === Team.ALLY ? Team.ENEMY : Team.ALLY
}

/**
 * Get candidates with optional exclusion
 */
export function getCandidates(
  grid: Grid,
  targetTeam: Team,
  excludeCharacterId?: number,
): TargetCandidate[] {
  const candidates = getTeamCharacters(grid, targetTeam)

  // Filter out excluded character if specified
  if (excludeCharacterId !== undefined) {
    return candidates.filter((c) => c.characterId !== excludeCharacterId)
  }

  return candidates
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
 * Apply tie-breaking logic when multiple candidates are at the same distance
 */
function applyTieBreaker(
  sortedCandidates: TargetCandidate[],
  casterTeam: Team,
  tieBreaker: TieBreaker,
  referenceHexId: number,
): TargetCandidate | null {
  if (sortedCandidates.length === 0) return null

  // Get all candidates at the best distance
  const bestDistance = sortedCandidates[0].distances.get(referenceHexId) ?? 0
  const tiedCandidates = sortedCandidates.filter(
    (c) => (c.distances.get(referenceHexId) ?? 0) === bestDistance,
  )

  if (tiedCandidates.length === 1) {
    return tiedCandidates[0]
  }

  // Apply tie-breaking
  if (tieBreaker === TieBreaker.HEX_ID) {
    // Team-aware hex ID preference
    return tiedCandidates.sort((a, b) => {
      if (casterTeam === Team.ALLY) {
        return a.hexId - b.hexId // Lower hex ID wins for ally team
      } else {
        return b.hexId - a.hexId // Higher hex ID wins for enemy team
      }
    })[0]
  }

  // For SPIRAL tie-breaking, we'd need more complex logic (to be implemented later)
  // For now, default to first candidate
  return tiedCandidates[0]
}

/**
 * Main targeting function that handles all common cases
 */
export function findTarget(
  context: SkillContext,
  options: TargetingOptions,
): SkillTargetInfo | null {
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

  // Apply tie-breaking
  const winner = applyTieBreaker(sorted, team, options.tieBreaker, referenceHexId)

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
