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

export type TargetDirection = 'behind' | 'front'

/**
 * The tile straight behind a unit, or straight ahead of it: the bottom-left
 * neighbour behind an ally (whose back is the high-r board edge) and the
 * top-right one ahead of it, the reverse for an enemy, the same straight
 * convention findAdjacentPriorityTarget leads with. Undefined when that tile is
 * off the board, even if a diagonal on that side exists.
 */
function straightHexId(
  grid: Grid,
  hexId: number,
  team: Team,
  direction: TargetDirection,
): number | undefined {
  const towardHighR = (team === Team.ALLY) === (direction === 'behind')
  const neighbour = grid.getHexById(hexId).neighbor(towardHighR ? 3 : 0)
  return grid.getTileOrUndefined(neighbour)?.hex.getId()
}

/**
 * Adjacent-tile priority target (Daimon, phantimal Spirit Marks). Candidates
 * are the up-to-three adjacent tiles toward the team's back ('behind') or
 * front ('front'): straight behind/ahead first, then the caster-row side
 * neighbour, then the remaining diagonal. Off-board neighbours drop out of
 * the chain. The first candidate tile holding a same-team unit wins; a unit
 * `isCandidate` rejects is passed over, so the chain moves to the next tile.
 */
export function findAdjacentPriorityTarget(
  context: SkillContext,
  direction: TargetDirection = 'behind',
  isCandidate: (characterId: number) => boolean = () => true,
): SkillTargetInfo | null {
  const { grid, hexId, characterId, team } = context
  const centerHex = grid.getHexById(hexId)

  const towardHighR = (team === Team.ALLY) === (direction === 'behind')
  // Straight behind an ally is its bottom-left neighbour (indices follow
  // Hex.DIRECTIONS order); the enemy and 'front' chains are the point mirror.
  const priorityDirections = towardHighR
    ? [3, 4, 2] // bottom-left, left, bottom-right
    : [0, 1, 5] // top-right, right, top-left

  const candidateMap = new Map(
    getCandidates(grid, team, characterId)
      .filter((c) => isCandidate(c.characterId))
      .map((c) => [c.hexId, c]),
  )

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

function findUnitStraight(ctx: SkillContext, direction: TargetDirection): SkillTargetInfo | null {
  const hexId = straightHexId(ctx.grid, ctx.hexId, ctx.team, direction)
  if (hexId === undefined) return null
  const tile = ctx.grid.getTileById(hexId)
  if (tile.characterId !== undefined && tile.team === ctx.team) {
    return { targetHexId: hexId, targetCharacterId: tile.characterId }
  }
  return null
}

/**
 * Target the same-team unit standing on the tile directly behind the caster,
 * or null when that tile is empty, off the board, or holds the other team.
 */
export function findUnitBehind(ctx: SkillContext): SkillTargetInfo | null {
  return findUnitStraight(ctx, 'behind')
}

/** The same as findUnitBehind, on the tile directly in front of the caster. */
export function findUnitInFront(ctx: SkillContext): SkillTargetInfo | null {
  return findUnitStraight(ctx, 'front')
}
