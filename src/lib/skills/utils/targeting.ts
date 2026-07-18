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

export type TargetDirection = 'behind' | 'front'

/**
 * Adjacent-tile priority target (Daimon, phantimal Spirit Marks). Candidates
 * are the up-to-three adjacent tiles toward the team's back ('behind': lower
 * hex IDs for allies, higher for enemies) or front ('front': mirrored).
 * Priority by ID: the extreme first (straight behind/ahead), then the
 * remaining candidate whose ID is nearest the caster's (the caster-row side
 * neighbour), then the last. The first candidate tile holding a same-team
 * unit wins.
 */
export function findAdjacentPriorityTarget(
  context: SkillContext,
  direction: TargetDirection = 'behind',
): SkillTargetInfo | null {
  const { grid, hexId, characterId, team } = context
  const centerHex = grid.getHexById(hexId)

  const lowerIds = (team === Team.ALLY) === (direction === 'behind')
  const candidateIds = grid
    .getAllTiles()
    .filter((tile) => centerHex.distance(tile.hex) === 1)
    .map((tile) => tile.hex.getId())
    .filter((id) => (lowerIds ? id < hexId : id > hexId))
    .sort((a, b) => (lowerIds ? a - b : b - a))

  const priority =
    candidateIds.length === 3
      ? [candidateIds[0]!, candidateIds[2]!, candidateIds[1]!]
      : candidateIds

  const candidateMap = new Map(getCandidates(grid, team, characterId).map((c) => [c.hexId, c]))

  for (const tileId of priority) {
    const candidate = candidateMap.get(tileId)
    if (candidate) {
      return {
        targetHexId: candidate.hexId,
        targetCharacterId: candidate.characterId,
        metadata: { sourceHexId: hexId, distance: 1 },
      }
    }
  }

  return null
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
