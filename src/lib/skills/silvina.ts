import type { Skill, SkillContext, SkillTargetInfo } from '../skill'
import { Team } from '../types/team'
import { Hex } from '../hex'
import { getSymmetricalHexId } from './utils/symmetry'
import { getOpposingCharacters } from './utils/targeting'

/**
 * Find the nearest enemy using a spiral search pattern.
 *
 * Search pattern:
 * - Ally team: Walks clockwise starting after top-right position (q+N, r-N)
 * - Enemy team: Walks counter-clockwise starting after bottom-left position (q-N, r+N)
 *
 * The search expands ring by ring (distance 1, 2, 3...) until an enemy is found.
 * Within each ring, tiles are checked in the appropriate walk order.
 */
function findNearestEnemySpiral(
  grid: any,
  symmetricalHexId: number,
  team: Team,
): SkillTargetInfo | null {
  const centerHex = grid.getHexById(symmetricalHexId)
  if (!centerHex) return null

  const enemies = getOpposingCharacters(grid, team)
  if (enemies.length === 0) return null

  // Create lookup structures for efficient enemy checking
  const enemyTileSet = new Set(enemies.map((e) => e.hexId))
  const enemyMap = new Map(enemies.map((e) => [e.hexId, e.characterId]))

  // Track examined tiles for debug info
  const examinedTiles: number[] = []

  // Find the maximum distance to any enemy
  let maxDistance = 0
  for (const enemy of enemies) {
    const enemyHex = grid.getHexById(enemy.hexId)
    if (!enemyHex) continue
    const distance = centerHex.distance(enemyHex)
    if (distance > maxDistance) maxDistance = distance
  }

  // Search expanding rings from distance 1 outward
  for (let distance = 1; distance <= maxDistance; distance++) {
    const ringTiles: Array<{ hexId: number; angle: number }> = []
    const allTiles = grid.getAllTiles ? grid.getAllTiles() : []
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
        let normalizedAngle: number
        if (team === Team.ALLY) {
          // Start walk after top-right (-60°), normalize from -30°
          normalizedAngle = (angle + Math.PI / 6 + 2 * Math.PI) % (2 * Math.PI)
        } else {
          // Start walk after bottom-left (120°), normalize from 150° and reverse
          const tempAngle = (angle - (5 * Math.PI) / 6 + 2 * Math.PI) % (2 * Math.PI)
          normalizedAngle = 2 * Math.PI - tempAngle
        }

        ringTiles.push({ hexId: tileId, angle: normalizedAngle })
      }
    }

    // Fallback: if grid doesn't provide all tiles, check only enemy positions
    if (ringTiles.length === 0) {
      const enemiesAtDistance: number[] = []
      for (const enemy of enemies) {
        const enemyHex = grid.getHexById(enemy.hexId)
        if (enemyHex && centerHex.distance(enemyHex) === distance) {
          enemiesAtDistance.push(enemy.hexId)
        }
      }

      if (enemiesAtDistance.length === 0) continue

      // Sort enemies by angle for clockwise walk
      const enemiesWithAngles = enemiesAtDistance.map((hexId) => {
        const hex = grid.getHexById(hexId)!
        const dq = hex.q - centerHex.q
        const dr = hex.r - centerHex.r
        const x = (3 / 2) * dq
        const y = Math.sqrt(3) * (dr + dq / 2)
        let angle = Math.atan2(y, x)

        let normalizedAngle: number
        if (team === Team.ALLY) {
          normalizedAngle = (angle + Math.PI / 6 + 2 * Math.PI) % (2 * Math.PI)
        } else {
          // Enemy team: counter-clockwise from bottom-left
          const tempAngle = (angle - (5 * Math.PI) / 6 + 2 * Math.PI) % (2 * Math.PI)
          normalizedAngle = 2 * Math.PI - tempAngle // Reverse for counter-clockwise
        }

        return { hexId, angle: normalizedAngle }
      })

      enemiesWithAngles.sort((a, b) => a.angle - b.angle)

      const selected = enemiesWithAngles[0]

      // Add all examined tiles from this distance
      enemiesWithAngles.forEach((e) => examinedTiles.push(e.hexId))

      return {
        targetHexId: selected.hexId,
        targetCharacterId: enemyMap.get(selected.hexId)!,
        metadata: {
          symmetricalHexId,
          isSymmetricalTarget: false,
          examinedTiles: [...examinedTiles],
        },
      }
    }

    // Sort and walk through tiles to find first enemy
    ringTiles.sort((a, b) => a.angle - b.angle)

    for (const tile of ringTiles) {
      examinedTiles.push(tile.hexId)
      if (enemyTileSet.has(tile.hexId)) {
        return {
          targetHexId: tile.hexId,
          targetCharacterId: enemyMap.get(tile.hexId)!,
          metadata: {
            symmetricalHexId,
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
 * Calculate the target for Silvina's First Strike skill.
 *
 * Targeting priority:
 * 1. Enemy on the symmetrical tile (immediate target)
 * 2. Nearest enemy to the symmetrical tile (spiral search)
 */
export function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, hexId } = context
  const opposingTeam = team === Team.ALLY ? Team.ENEMY : Team.ALLY

  const symmetricalHexId = getSymmetricalHexId(hexId)
  if (!symmetricalHexId) return null

  // Priority 1: Check for enemy on the symmetrical tile
  const symmetricalTile = grid.getTileById(symmetricalHexId)
  if (symmetricalTile?.characterId && symmetricalTile.team === opposingTeam) {
    return {
      targetHexId: symmetricalHexId,
      targetCharacterId: symmetricalTile.characterId,
      metadata: {
        symmetricalHexId,
        isSymmetricalTarget: true,
        examinedTiles: [symmetricalHexId], // Only examined the symmetrical tile
      },
    }
  }

  // Priority 2: Find nearest enemy via spiral search
  return findNearestEnemySpiral(grid, symmetricalHexId, team)
}

export const silvinaSkill: Skill = {
  id: 'silvina',
  characterId: 39,
  name: 'First Strike',
  description:
    'Targets the character on the opposing team on a symmetrical tile to Silvina. If no character is found on the symmetrical tile, target the closest opposing character to the symmetrical tile.',
  targetingColorModifier: '#68ab21', // Green color for targeting arrow

  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context

    // Calculate initial target
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
      // Add source hex to metadata
      targetInfo.metadata = {
        ...targetInfo.metadata,
        sourceHexId: hexId,
      }
      // Store the targeting state
      skillManager.setSkillTarget(characterId, team, targetInfo)
    }
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Clear targeting state
    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    const { team, skillManager, characterId, hexId } = context

    // Recalculate target on any grid change
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
      // Add source hex to metadata (hexId is now always current)
      targetInfo.metadata = {
        ...targetInfo.metadata,
        sourceHexId: hexId,
      }
      skillManager.setSkillTarget(characterId, team, targetInfo)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  },
}
