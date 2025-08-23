import type { Grid } from '../../grid'
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

