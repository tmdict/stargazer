import { getTilesWithCharacters } from '../../characters/character'
import type { Grid } from '../../grid'
import { Team } from '../../types/team'

/**
 * Shared targeting methods
 */

export interface TargetCandidate {
  hexId: number
  characterId: number
  distances: Map<number, number> // hexId -> distance
}

/**
 * Get all target candidates for a given team
 */
export function getTeamTargetCandidates(grid: Grid, team: Team): TargetCandidate[] {
  const characters: TargetCandidate[] = []

  // Only tiles holding characters can be candidates
  const tilesWithCharacters = getTilesWithCharacters(grid)

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
 * Get candidates with optional exclusion
 */
export function getCandidates(
  grid: Grid,
  targetTeam: Team,
  excludeCharacterId?: number,
): TargetCandidate[] {
  const candidates = getTeamTargetCandidates(grid, targetTeam)

  // Filter out excluded character if specified
  if (excludeCharacterId !== undefined) {
    return candidates.filter((c) => c.characterId !== excludeCharacterId)
  }

  return candidates
}
