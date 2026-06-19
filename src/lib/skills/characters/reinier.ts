import { Team } from '../../types/team'
import { registerSkill } from '../registry'
import { type SkillContext } from '../skill'
import { getSymmetricalHexId } from '../utils/symmetry'

const TILE_COLOR = '#9661f1'

/**
 * Get adjacent allies to the given hex position
 * Returns array of {hexId, position} where position is 0-5 indicating direction
 *
 * Hexagonal neighbor positions (clockwise from top-right):
 *        5     0
 *         \ _ /
 *       4 |   | 1
 *         / ‾ \
 *        3     2
 */
function getAdjacentAllies(context: SkillContext): Array<{ hexId: number; position: number }> {
  const { grid, hexId, team } = context
  const centerHex = grid.getHexById(hexId)
  if (!centerHex) return []

  const adjacentAllies: Array<{ hexId: number; position: number }> = []
  const neighbors = centerHex.getNeighbors()

  neighbors.forEach((neighborHex, position) => {
    // Off-grid neighbors are expected for edge hexes
    const neighborTile = grid.getTileOrUndefined(neighborHex)
    if (!neighborTile) return

    if (neighborTile.characterId && neighborTile.team === team) {
      adjacentAllies.push({
        hexId: neighborTile.hex.getId(),
        position,
      })
    }
  })

  return adjacentAllies
}

/**
 * Check if there's an enemy on the symmetrical tile of the given ally
 */
function findSymmetricalEnemy(context: SkillContext, allyHexId: number): number | null {
  const { grid, team } = context

  // Get the symmetrical hex ID
  const symmetricalHexId = getSymmetricalHexId(grid, allyHexId)
  if (!symmetricalHexId) return null

  // Check if there's an enemy on the symmetrical tile
  const symmetricalTile = grid.getTileById(symmetricalHexId)
  if (!symmetricalTile) return null

  // Check if it has an enemy character
  const enemyTeam = team === Team.ALLY ? Team.ENEMY : Team.ALLY
  if (symmetricalTile.characterId && symmetricalTile.team === enemyTeam) {
    return symmetricalHexId
  }

  return null
}

/**
 * Find the highest priority ally that has a valid enemy target
 * Returns the ally and enemy hex IDs, or null if no valid pair exists
 *
 * TIE-BREAKING LOGIC:
 * When multiple adjacent allies exist, we need to select one based on position priority.
 *
 * Hexagonal neighbors are indexed 0-5 in clockwise order:
 *   Position 0: Top-right
 *   Position 1: Right
 *   Position 2: Bottom-right
 *   Position 3: Bottom-left
 *   Position 4: Left
 *   Position 5: Top-left
 *
 * Priority order for ALLY team (targeting enemy):
 *   [3, 4, 2, 1, 5, 0] = Bottom-left > Left > Bottom-right > Right > Top-left > Top-right
 *
 * Priority order for ENEMY team (targeting ally):
 *   [0, 5, 1, 2, 4, 3] = Top-right > Top-left > Right > Bottom-right > Left > Bottom-left
 *   (This is a 180-degree rotation of the ally priority)
 *
 * The algorithm:
 * 1. Sort all adjacent allies by their position priority
 * 2. Check each ally in priority order to see if they have a valid enemy on their symmetrical tile
 * 3. Return the first valid ally-enemy pair found
 */
function findValidAllyEnemyPair(
  context: SkillContext,
  adjacentAllies: Array<{ hexId: number; position: number }>,
  team: Team,
): { allyHexId: number; enemyHexId: number } | null {
  // Priority arrays define which neighbor positions to check first
  // Lower index = higher priority
  const allyPriority = team === Team.ALLY ? [3, 4, 2, 1, 5, 0] : [0, 5, 1, 2, 4, 3]

  const sortedAllies = [...adjacentAllies].sort((a, b) => {
    const priorityA = allyPriority.indexOf(a.position)
    const priorityB = allyPriority.indexOf(b.position)
    return priorityA - priorityB // Lower priority index comes first
  })

  // Check each ally in priority order to find one with a valid enemy target
  for (const ally of sortedAllies) {
    const enemyHexId = findSymmetricalEnemy(context, ally.hexId)
    if (enemyHexId) {
      return { allyHexId: ally.hexId, enemyHexId }
    }
  }

  return null
}

/**
 * Calculate and set skill targets
 */
function updateSkillTargets(context: SkillContext): void {
  const { skillManager, team, characterId } = context

  // Highest-priority adjacent ally that has an enemy on its symmetrical tile.
  const adjacentAllies = getAdjacentAllies(context)
  const validPair = adjacentAllies.length
    ? findValidAllyEnemyPair(context, adjacentAllies, team)
    : null

  if (!validPair) {
    skillManager.clearSkillTarget(characterId, team)
    skillManager.clearPaintedTiles(characterId, team)
    return
  }

  // skillTarget carries the semantic pair (read by the debug overlay); paintTiles
  // owns the tile-color set/remove diff.
  skillManager.setSkillTarget(characterId, team, {
    targetHexId: validPair.allyHexId,
    targetCharacterId: null,
    metadata: { allyHexId: validPair.allyHexId, enemyHexId: validPair.enemyHexId },
  })
  // Each tile is painted in both channels (border + fill), so each hex id appears twice.
  skillManager.paintTiles(characterId, team, [
    { hexId: validPair.allyHexId, color: TILE_COLOR },
    { hexId: validPair.allyHexId, color: TILE_COLOR, fill: true },
    { hexId: validPair.enemyHexId, color: TILE_COLOR },
    { hexId: validPair.enemyHexId, color: TILE_COLOR, fill: true },
  ])
}

// Targets an adjacent ally whose symmetrical tile holds an enemy, painting both
// the ally and that enemy. The neighbour priority and the mirror-holds-enemy gate
// are Reinier-specific, kept here rather than via the shared rowScan: the within-row
// order alternates (not purely front- or rearmost) and the pick is conditional on
// the symmetrical tile.
registerSkill({
  id: 'reinier',
  characterId: 31,

  onActivate(context: SkillContext): void {
    updateSkillTargets(context)
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context
    skillManager.clearPaintedTiles(characterId, team)
    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    updateSkillTargets(context)
  },
})
