import { getTilesWithCharacters } from '../../characters/character'
import type { Grid } from '../../grid'
import { Team } from '../../types/team'
import type { SkillContext, SkillTargetInfo } from '../skill'

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

  if (excludeCharacterId !== undefined) {
    return candidates.filter((c) => c.characterId !== excludeCharacterId)
  }

  return candidates
}

/**
 * The tile directly behind a unit: an adjacent tile one row toward its team's
 * back, where rows run along the hex `r` axis (a greater `r` is behind for
 * allies, a smaller `r` for enemies). A same-row side neighbour is never behind.
 * When both back-row neighbours exist (back-left and back-right), the lower hex
 * ID is taken for allies and the higher for enemies. Undefined at the back edge
 * where no tile lies behind.
 */
export function directlyBehindHexId(grid: Grid, hexId: number, team: Team): number | undefined {
  const center = grid.getHexById(hexId)
  const behindIds = grid
    .getAllTiles()
    .filter((tile) => center.distance(tile.hex) === 1)
    .filter((tile) => (team === Team.ALLY ? tile.hex.r > center.r : tile.hex.r < center.r))
    .map((tile) => tile.hex.getId())
  if (behindIds.length === 0) return undefined
  return team === Team.ALLY ? Math.min(...behindIds) : Math.max(...behindIds)
}

/**
 * Target the same-team unit standing on the tile directly behind the caster,
 * or null when that tile is empty, off the board, or holds the other team.
 */
export function findUnitBehind(ctx: SkillContext): SkillTargetInfo | null {
  const behindId = directlyBehindHexId(ctx.grid, ctx.hexId, ctx.team)
  if (behindId === undefined) return null
  const tile = ctx.grid.getTileById(behindId)
  if (tile.characterId !== undefined && tile.team === ctx.team) {
    return { targetHexId: behindId, targetCharacterId: tile.characterId }
  }
  return null
}
