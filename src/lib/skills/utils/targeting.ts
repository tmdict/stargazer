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
  REARMOST, // Scans hex IDs based on team: ally scans 45→1, enemy scans 1→45
}

export interface TargetingOptions {
  targetTeam: Team
  excludeSelf?: boolean
  targetingMethod: TargetingMethod
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
 * Find the rearmost target based on hex ID scanning order.
 *
 * Rearmost is determined by position in the grid:
 * - Ally team targeting enemies: Scans hex IDs from 45 down to 1 (largest to smallest)
 *   This targets enemies furthest back (row 15 first, then 14, etc.)
 * - Enemy team targeting allies: Scans hex IDs from 1 up to 45 (smallest to largest)
 *   This targets allies furthest back (row 1 first, then 2, etc.)
 *
 * Within the same diagonal row, higher hex IDs are considered "further back"
 * for the enemy side, and lower hex IDs are "further back" for the ally side.
 */
export function findRearmostTarget(
  context: SkillContext,
  targetTeam: Team,
): SkillTargetInfo | null {
  const { grid, team, hexId } = context

  // Get all candidates on the target team
  const candidates = getTeamCharacters(grid, targetTeam)
  if (candidates.length === 0) return null

  // Optimize by finding max/min hex ID directly instead of scanning all tiles
  let rearmostCandidate: TargetCandidate
  if (team === Team.ALLY) {
    // Ally → Enemy: largest hex ID is rearmost
    rearmostCandidate = candidates.reduce((max, current) =>
      current.hexId > max.hexId ? current : max,
    )
  } else {
    // Enemy → Ally: smallest hex ID is rearmost
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
 * Searches outward  from a given tile (usually a symmetrical tile) in a spiral pattern
 * until finding the first target.
 *
 * Search pattern:
 * - Ally team: Walks clockwise starting after top-right position (q+N, r-N)
 * - Enemy team: Walks counter-clockwise starting after bottom-left position (q-N, r+N)
 *
 * The search expands ring by ring (distance 1, 2, 3...) until a target is found.
 * Within each ring, tiles are checked in the appropriate walk order.
 */
export function spiralSearchFromTile(
  grid: Grid,
  centerHexId: number,
  targetTeam: Team,
  casterTeam: Team,
): SkillTargetInfo | null {
  const centerHex = grid.getHexById(centerHexId)
  if (!centerHex) return null

  const candidates = getTeamCharacters(grid, targetTeam)
  if (candidates.length === 0) return null

  // Create lookup structures for efficient checking
  const candidateTileSet = new Set(candidates.map((c) => c.hexId))
  const candidateMap = new Map(candidates.map((c) => [c.hexId, c.characterId]))

  // Track examined tiles for debug info
  const examinedTiles: number[] = []

  // Find the maximum distance to any candidate
  let maxDistance = 0
  for (const candidate of candidates) {
    const candidateHex = grid.getHexById(candidate.hexId)
    if (!candidateHex) continue
    const distance = centerHex.distance(candidateHex)
    if (distance > maxDistance) maxDistance = distance
  }

  // Search expanding rings from distance 1 outward
  for (let distance = 1; distance <= maxDistance; distance++) {
    const ringTiles: Array<{ hexId: number; angle: number }> = []
    const allTiles = grid.getAllTiles()

    // Collect all tiles at the current distance
    for (const tile of allTiles) {
      if (tile?.hex && centerHex.distance(tile.hex) === distance) {
        const tileHex = tile.hex
        const tileId = tileHex.getId()
        const dq = tileHex.q - centerHex.q
        const dr = tileHex.r - centerHex.r

        // Convert hex coordinates to angle for sorting
        const x = (3 / 2) * dq
        const y = Math.sqrt(3) * (dr + dq / 2)
        const angle = Math.atan2(y, x)

        // Normalize angle based on team's walk direction
        // Ally: clockwise from top-right
        // Enemy: counter-clockwise from bottom-left
        let normalizedAngle: number
        if (casterTeam === Team.ALLY) {
          // Ally team: Start walk after top-right (-60°), normalize from -30°
          // This creates a clockwise walk starting just after the top-right position
          normalizedAngle = (angle + Math.PI / 6 + 2 * Math.PI) % (2 * Math.PI)
        } else {
          // Enemy team: Start walk after bottom-left (120°), normalize from 150° and reverse
          // This creates a counter-clockwise walk starting just after the bottom-left position
          const tempAngle = (angle - (5 * Math.PI) / 6 + 2 * Math.PI) % (2 * Math.PI)
          normalizedAngle = 2 * Math.PI - tempAngle
        }

        ringTiles.push({ hexId: tileId, angle: normalizedAngle })
      }
    }

    // Sort tiles by their angle to create the spiral walk order
    ringTiles.sort((a, b) => a.angle - b.angle)

    // Walk through tiles in spiral order and return the first target found
    for (const tile of ringTiles) {
      examinedTiles.push(tile.hexId)
      if (candidateTileSet.has(tile.hexId)) {
        return {
          targetHexId: tile.hexId,
          targetCharacterId: candidateMap.get(tile.hexId)!,
          metadata: {
            symmetricalHexId: centerHexId,
            isSymmetricalTarget: false,
            examinedTiles: [...examinedTiles],
          },
        }
      }
    }
  }

  return null
}
