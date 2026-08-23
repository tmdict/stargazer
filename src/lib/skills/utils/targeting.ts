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
 * Record each candidate's distance from every reference hex.
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
 * The tile directly behind a unit: the bottom-left neighbour for allies
 * (whose back is the high-r board edge), top-right for enemies, the same
 * straight-behind convention findAdjacentPriorityTarget leads with. Undefined
 * when that tile is off the board, even if the other back-row diagonal exists.
 */
export function directlyBehindHexId(grid: Grid, hexId: number, team: Team): number | undefined {
  const center = grid.getHexById(hexId)
  const behind = center.neighbor(team === Team.ALLY ? 3 : 0)
  return grid.getTileOrUndefined(behind)?.hex.getId()
}

export type TargetDirection = 'behind' | 'front'

/**
 * Adjacent-tile priority target (Daimon, phantimal Spirit Marks). Candidates
 * are the up-to-three adjacent tiles toward the team's back ('behind') or
 * front ('front'): straight behind/ahead first, then the caster-row side
 * neighbour, then the remaining diagonal. Off-board neighbours drop out of
 * the chain. The first candidate tile holding a same-team unit wins.
 */
export function findAdjacentPriorityTarget(
  context: SkillContext,
  direction: TargetDirection = 'behind',
): SkillTargetInfo | null {
  const { grid, hexId, characterId, team } = context
  const centerHex = grid.getHexById(hexId)

  const towardHighR = (team === Team.ALLY) === (direction === 'behind')
  // Straight behind an ally is its bottom-left neighbour (indices follow
  // Hex.DIRECTIONS order); the enemy and 'front' chains are the point mirror.
  const priorityDirections = towardHighR
    ? [3, 4, 2] // bottom-left, left, bottom-right
    : [0, 1, 5] // top-right, right, top-left

  const candidateMap = new Map(getCandidates(grid, team, characterId).map((c) => [c.hexId, c]))

  for (const dir of priorityDirections) {
    const tile = grid.getTileOrUndefined(centerHex.neighbor(dir))
    const candidate = tile && candidateMap.get(tile.hex.getId())
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
