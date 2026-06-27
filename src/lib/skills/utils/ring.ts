import type { Grid } from '../../grid'
import { Team } from '../../types/team'
import type { SkillContext, SkillTargetInfo } from '../skill'
import { calculateDistances, getCandidates, getTeamTargetCandidates } from './targeting'

/**
 * Ring expansion scans
 */

// One end of the scanned team's front-to-back axis. A row scan uses it twice and
// independently: which diagonal rows to reach first, and which unit within a
// shared row to take first. For the ally team FRONTMOST is the higher diagonal /
// higher hex id; the enemy team is flipped 180°.
export enum ScanDirection {
  FRONTMOST,
  REARMOST,
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

  const candidates = getTeamTargetCandidates(grid, targetTeam)
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

  const allTiles = grid.getAllTiles()

  // Search expanding rings from distance 1 outward
  for (let distance = 1; distance <= maxDistance; distance++) {
    const ringTiles: Array<{ hexId: number; angle: number }> = []

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

/**
 * Search for ally characters in the same diagonal row as the caster.
 * Prioritizes by closest distance, then team-aware hex ID tie-breaking:
 * ally caster prefers higher hex ID, enemy caster prefers lower.
 */
export function searchByRow(context: SkillContext, targetTeam: Team): SkillTargetInfo | null {
  const { grid, hexId, characterId, team } = context

  const candidates = getCandidates(grid, targetTeam, characterId)
  if (candidates.length === 0) return null

  // Filter to only those in the same diagonal row
  const casterDiagonal = grid.getHexById(hexId).getDiagonal()
  const sameRowCandidates = candidates.filter(
    (c) => grid.getHexById(c.hexId).getDiagonal() === casterDiagonal,
  )

  if (sameRowCandidates.length === 0) return null

  calculateDistances(sameRowCandidates, [hexId], grid)

  sameRowCandidates.sort((a, b) => {
    const distA = a.distances.get(hexId) ?? Infinity
    const distB = b.distances.get(hexId) ?? Infinity

    if (distA !== distB) {
      return distA - distB
    }

    // Team-aware tie-breaking: ally prefers higher hex ID, enemy prefers lower
    return team === Team.ALLY ? b.hexId - a.hexId : a.hexId - b.hexId
  })

  const target = sameRowCandidates[0]
  if (!target) return null

  return {
    targetHexId: target.hexId,
    targetCharacterId: target.characterId,
    metadata: {
      sourceHexId: hexId,
      distance: target.distances.get(hexId),
      isRowTarget: true,
      examinedTiles: sameRowCandidates.map((c) => c.hexId),
    },
  }
}

export interface RowScanOptions {
  // Team to scan for (the candidates), and the front-to-back frame: rows and the
  // within-row order are oriented to this team. Skills scan their own team.
  team: Team
  // Which diagonal rows to reach first (REARMOST = the team's back rows first).
  rowDirection: ScanDirection
  // Within a shared diagonal row, which unit to take first. Defaults to
  // rowDirection (the aligned, common case); set it only for a mixed scan.
  withinRowDirection?: ScanDirection
  // Bound on how far out to scan: 1 = adjacent tiles only; omit = whole grid.
  maxDistance?: number
  // Keep only candidates whose characterId passes this predicate (e.g. a class
  // filter, or excluding companions).
  filter?: (characterId: number) => boolean
}

/**
 * Scan for a unit on `options.team` by expanding distance rings from the caster.
 * Within a ring, candidates are ordered by diagonal row (q - r), then by hex id
 * within a row; rowDirection and withinRowDirection independently choose which end
 * of that team's front-to-back axis comes first. Returns the first candidate, or null.
 *
 * Scan key: (distance asc, diagonal by rowDirection, hex id by withinRowDirection),
 * both the diagonal and hex-id directions flipped when scanning the enemy team.
 *
 * Hex ids increase along the diagonal rows, so when the two directions agree the
 * scan is equivalently a plain hex-id sort; only a mixed pair (e.g. rear rows but
 * the front of each row) needs the diagonal ordering to be explicit.
 */
export function rowScan(ctx: SkillContext, options: RowScanOptions): SkillTargetInfo | null {
  const { grid, hexId, characterId } = ctx
  const center = grid.getHexById(hexId)

  let candidates = getCandidates(grid, options.team, characterId)
  if (options.filter) candidates = candidates.filter((c) => options.filter!(c.characterId))

  const ranked = candidates
    .map((c) => {
      const hex = grid.getHexById(c.hexId)
      return {
        hexId: c.hexId,
        characterId: c.characterId,
        distance: center.distance(hex),
        diagonal: hex.getDiagonal(),
      }
    })
    .filter((c) => options.maxDistance === undefined || c.distance <= options.maxDistance)
  if (ranked.length === 0) return null

  const withinRowDirection = options.withinRowDirection ?? options.rowDirection
  const allyTeam = options.team === Team.ALLY
  const rowAscending = allyTeam === (options.rowDirection === ScanDirection.REARMOST)
  const idAscending = allyTeam === (withinRowDirection === ScanDirection.REARMOST)
  ranked.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    if (a.diagonal !== b.diagonal)
      return rowAscending ? a.diagonal - b.diagonal : b.diagonal - a.diagonal
    return idAscending ? a.hexId - b.hexId : b.hexId - a.hexId
  })

  const target = ranked[0]!
  return {
    targetHexId: target.hexId,
    targetCharacterId: target.characterId,
    metadata: {
      sourceHexId: hexId,
      distance: target.distance,
      isRowScanTarget: true,
      examinedTiles: ranked.map((c) => c.hexId),
    },
  }
}
