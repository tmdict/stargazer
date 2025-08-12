import type { Skill, SkillContext, SkillTargetInfo } from '../skill'
import { Team } from '../types/team'
import { getSymmetricalHexId } from './utils/symmetry'

/**
 * Get adjacent allies to the given hex position
 * Returns array of {hexId, position} where position is 0-5 indicating direction
 */
function getAdjacentAllies(context: SkillContext): Array<{ hexId: number; position: number }> {
  const { grid, hexId, team } = context
  const centerHex = grid.getHexById(hexId)
  if (!centerHex) return []

  const adjacentAllies: Array<{ hexId: number; position: number }> = []
  const neighbors = centerHex.getNeighbors()

  neighbors.forEach((neighborHex, position) => {
    // Check if this neighbor hex exists on the grid
    // Use a try-catch since getTile throws for non-existent tiles
    try {
      const neighborTile = grid.getTile(neighborHex)
      if (!neighborTile) return

      // Check if this neighbor has an ally
      if (neighborTile.characterId && neighborTile.team === team) {
        // Get the neighbor hex ID from the tile
        const neighborHexId = neighborTile.hex.getId()
        adjacentAllies.push({
          hexId: neighborHexId,
          position,
        })
      }
    } catch (error) {
      // Neighbor hex is outside grid boundaries, skip it
      return
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
  const symmetricalHexId = getSymmetricalHexId(allyHexId)
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
 */
function findValidAllyEnemyPair(
  context: SkillContext,
  adjacentAllies: Array<{ hexId: number; position: number }>,
  team: Team,
): { allyHexId: number; enemyHexId: number } | null {
  // Sort allies by priority
  const allyPriority = team === Team.ALLY ? [3, 4, 2, 1, 5, 0] : [0, 5, 1, 2, 4, 3]

  const sortedAllies = [...adjacentAllies].sort((a, b) => {
    const priorityA = allyPriority.indexOf(a.position)
    const priorityB = allyPriority.indexOf(b.position)
    return priorityA - priorityB
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

  // Get previous targets to clear their tile modifiers
  const previousTarget = skillManager.getSkillTarget(characterId, team)
  if (previousTarget?.metadata) {
    const { allyHexId: prevAlly, enemyHexId: prevEnemy } = previousTarget.metadata
    if (prevAlly) skillManager.removeTileColorModifier(prevAlly)
    if (prevEnemy) skillManager.removeTileColorModifier(prevEnemy)
  }

  // Find adjacent allies
  const adjacentAllies = getAdjacentAllies(context)

  if (adjacentAllies.length === 0) {
    // No adjacent allies, clear any existing targets
    skillManager.clearSkillTarget(characterId, team)
    return
  }

  // Find the highest priority ally that has a valid enemy target
  const validPair = findValidAllyEnemyPair(context, adjacentAllies, team)

  if (!validPair) {
    // No valid ally-enemy pair found, clear targets
    skillManager.clearSkillTarget(characterId, team)
    return
  }

  // Set skill targets with metadata
  const targetInfo: SkillTargetInfo = {
    targetHexId: validPair.allyHexId,
    targetCharacterId: null,
    metadata: {
      allyHexId: validPair.allyHexId,
      enemyHexId: validPair.enemyHexId,
    },
  }

  skillManager.setSkillTarget(characterId, team, targetInfo)

  // Set tile color modifiers for visual feedback
  skillManager.setTileColorModifier(validPair.allyHexId, reinierSkill.tileColorModifier!)
  skillManager.setTileColorModifier(validPair.enemyHexId, reinierSkill.tileColorModifier!)
}

export const reinierSkill: Skill = {
  id: 'reinier',
  characterId: 31,
  name: 'Dynamic Balance',
  description:
    'Targets an adjacent ally position with an enemy hero if both the ally and enemy are placed on a symmetrical tile.',
  tileColorModifier: '#ad51cb', // Purple tile border

  onActivate(context: SkillContext): void {
    updateSkillTargets(context)
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Clear tile modifiers for current targets before clearing the skill target
    const currentTarget = skillManager.getSkillTarget(characterId, team)
    if (currentTarget?.metadata) {
      const { allyHexId, enemyHexId } = currentTarget.metadata
      if (allyHexId) skillManager.removeTileColorModifier(allyHexId)
      if (enemyHexId) skillManager.removeTileColorModifier(enemyHexId)
    }

    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    updateSkillTargets(context)
  },
}
