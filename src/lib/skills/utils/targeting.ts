import type { Grid, GridTile } from '../../grid'
import type { Hex } from '../../hex'
import { Team } from '../../types/team'

export interface TargetCandidate {
  hexId: number
  characterId: number
  distances: Map<number, number> // hexId -> distance
}

/**
 * Get all characters for a given team
 */
export function getTeamCharacters(grid: Grid, team: Team): TargetCandidate[] {
  const characters: TargetCandidate[] = []

  const tiles = grid.getAllTiles()
  for (const tile of tiles) {
    if (tile.characterId && tile.team === team) {
      characters.push({
        hexId: tile.hex.getId(),
        characterId: tile.characterId,
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
 * Sort candidates by multiple distance priorities
 */
export function sortByDistancePriorities(
  candidates: TargetCandidate[],
  priorities: number[], // Array of hex IDs in priority order
  sourceTeam: Team,
): TargetCandidate[] {
  return candidates.sort((a, b) => {
    // Check each priority in order
    for (const priorityHexId of priorities) {
      const distA = a.distances.get(priorityHexId) ?? Infinity
      const distB = b.distances.get(priorityHexId) ?? Infinity

      if (distA !== distB) {
        return distA - distB
      }
    }

    // Final tie-breaker: hex ID
    // Default behavior for non-Silvina skills
    if (sourceTeam === Team.ALLY) {
      return b.hexId - a.hexId // Highest ID wins for ally team
    } else {
      return a.hexId - b.hexId // Lowest ID wins for enemy team
    }
  })
}

/**
 * High-level targeting function combining all steps
 * Uses simple distance calculation without pathfinding
 */
export function findBestTarget(
  grid: Grid,
  sourceTeam: Team,
  priorityHexIds: number[],
): { hexId: number; characterId: number } | null {
  const candidates = getOpposingCharacters(grid, sourceTeam)

  if (candidates.length === 0) return null

  calculateDistances(candidates, priorityHexIds, grid)
  const sorted = sortByDistancePriorities(candidates, priorityHexIds, sourceTeam)

  return {
    hexId: sorted[0].hexId,
    characterId: sorted[0].characterId,
  }
}
