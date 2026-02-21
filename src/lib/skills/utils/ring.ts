import { isCompanionId } from '../../characters/companion'
import type { Grid } from '../../grid'
import { areHexesInSameDiagonalRow } from '../../types/grid'
import { Team } from '../../types/team'
import type { SkillContext, SkillTargetInfo } from '../skill'
import { calculateDistances, getCandidates, getTeamTargetCandidates } from './targeting'

/**
 * Ring expansion scans
 */

export enum RowScanDirection {
  FRONTMOST, // Ally: highest→lowest hex ID, Enemy: lowest→highest
  REARMOST, // Ally: lowest→highest hex ID, Enemy: highest→lowest
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

/**
 * Search for ally characters in the same diagonal row as the caster.
 * Prioritizes by closest distance, then team-aware hex ID tie-breaking:
 * ally caster prefers higher hex ID, enemy caster prefers lower.
 */
export function searchByRow(context: SkillContext, targetTeam: Team): SkillTargetInfo | null {
  const { grid, hexId, characterId, team } = context

  // Get all ally candidates
  const candidates = getCandidates(grid, targetTeam, characterId)
  if (candidates.length === 0) return null

  // Filter to only those in the same diagonal row
  const sameRowCandidates = candidates.filter((c) => areHexesInSameDiagonalRow(hexId, c.hexId))

  if (sameRowCandidates.length === 0) return null

  // Calculate distances for same-row candidates
  calculateDistances(sameRowCandidates, [hexId], grid)

  // Sort by distance (closest first), then by hex ID for ties
  sameRowCandidates.sort((a, b) => {
    const distA = a.distances.get(hexId) ?? Infinity
    const distB = b.distances.get(hexId) ?? Infinity

    if (distA !== distB) {
      return distA - distB // Closer distance wins
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

/**
 * Scan outward from the caster's position in rings, checking tiles by hex ID order.
 * Direction controls the scan order within each ring:
 * - FRONTMOST: Ally scans highest→lowest, Enemy scans lowest→highest
 * - REARMOST: Ally scans lowest→highest, Enemy scans highest→lowest
 */
export interface RowScanOptions {
  direction?: RowScanDirection
  excludeCompanions?: boolean
  maxDistance?: number
}

export function rowScan(
  context: SkillContext,
  targetTeam: Team,
  options: RowScanOptions = {},
): SkillTargetInfo | null {
  const { grid, hexId, characterId, team: casterTeam } = context
  const direction = options.direction ?? RowScanDirection.FRONTMOST

  const centerHex = grid.getHexById(hexId)
  if (!centerHex) return null

  // Get all ally candidates
  let candidates = getCandidates(grid, targetTeam, characterId)

  if (options.excludeCompanions) {
    candidates = candidates.filter((c) => !isCompanionId(grid, c.characterId))
  }
  if (candidates.length === 0) return null

  // Create a set for quick lookup
  const candidateSet = new Set(candidates.map((c) => c.hexId))
  const candidateMap = new Map(candidates.map((c) => [c.hexId, c.characterId]))

  const examinedTiles: number[] = []

  // Find maximum distance to any candidate
  let maxDistance = 0
  for (const candidate of candidates) {
    const candidateHex = grid.getHexById(candidate.hexId)
    if (!candidateHex) continue
    const distance = centerHex.distance(candidateHex)
    if (distance > maxDistance) maxDistance = distance
  }

  // Cap at the configured maximum distance if specified
  if (options.maxDistance !== undefined) {
    maxDistance = Math.min(maxDistance, options.maxDistance)
  }

  // Search expanding rings from distance 1 outward
  for (let distance = 1; distance <= maxDistance; distance++) {
    const ringTiles: number[] = []
    const allTiles = grid.getAllTiles()

    // Collect all tile IDs at the current distance
    for (const tile of allTiles) {
      if (tile?.hex && centerHex.distance(tile.hex) === distance) {
        ringTiles.push(tile.hex.getId())
      }
    }

    // Sort tiles by hex ID based on caster team and scan direction
    const ascending = (casterTeam === Team.ALLY) === (direction === RowScanDirection.REARMOST)
    if (ascending) {
      ringTiles.sort((a, b) => a - b)
    } else {
      ringTiles.sort((a, b) => b - a)
    }

    // Check each tile in order for an ally
    for (const tileId of ringTiles) {
      examinedTiles.push(tileId)
      if (candidateSet.has(tileId)) {
        return {
          targetHexId: tileId,
          targetCharacterId: candidateMap.get(tileId)!,
          metadata: {
            sourceHexId: hexId,
            distance,
            isRowScanTarget: true,
            examinedTiles: [...examinedTiles],
          },
        }
      }
    }
  }

  return null
}
