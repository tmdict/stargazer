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
 * Apply tie-breaking logic to select the highest priority ally
 * Position indices: 0=top-right, 1=right, 2=bottom-right, 3=bottom-left, 4=left, 5=top-left
 *
 * For ALLY to ENEMY targeting, priority order: 3 > 4 > 2 > 1 > 5 > 0
 * (bottom-left > left > bottom-right > right > top-left > top-right)
 * 
 * For ENEMY to ALLY targeting (180-degree rotation): 0 > 5 > 1 > 2 > 4 > 3
 * (top-right > top-left > right > bottom-right > left > bottom-left)
 */
function applyTieBreaking(
  adjacentAllies: Array<{ hexId: number; position: number }>,
  team: Team,
): number | null {
  if (adjacentAllies.length === 0) return null
  if (adjacentAllies.length === 1) return adjacentAllies[0].hexId

  // Priority order based on position indices
  // Ally team priority: bottom-left > left > bottom-right > right > top-left > top-right
  const allyPriority = [3, 4, 2, 1, 5, 0]
  // Enemy team priority (180-degree rotation): top-right > top-left > right > bottom-right > left > bottom-left
  const enemyPriority = [0, 5, 1, 2, 4, 3]

  const priorityOrder = team === Team.ALLY ? allyPriority : enemyPriority

  // Find the ally with the highest priority position
  let bestAlly = adjacentAllies[0]
  let bestPriorityIndex = priorityOrder.indexOf(bestAlly.position)

  for (const ally of adjacentAllies) {
    const priorityIndex = priorityOrder.indexOf(ally.position)
    if (priorityIndex < bestPriorityIndex) {
      bestAlly = ally
      bestPriorityIndex = priorityIndex
    }
  }

  return bestAlly.hexId
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

  // Apply tie-breaking to get the priority ally
  const targetAllyHexId = applyTieBreaking(adjacentAllies, team)

  if (!targetAllyHexId) {
    // No adjacent allies, clear any existing targets
    skillManager.clearSkillTarget(characterId, team)
    return
  }

  // Check if the ally has an enemy on its symmetrical tile
  const targetEnemyHexId = findSymmetricalEnemy(context, targetAllyHexId)

  if (!targetEnemyHexId) {
    // No enemy on symmetrical tile, clear targets
    skillManager.clearSkillTarget(characterId, team)
    return
  }

  // Set skill targets with metadata
  const targetInfo: SkillTargetInfo = {
    targetHexId: targetAllyHexId,
    targetCharacterId: null,
    metadata: {
      allyHexId: targetAllyHexId,
      enemyHexId: targetEnemyHexId,
    },
  }

  skillManager.setSkillTarget(characterId, team, targetInfo)

  // Set tile color modifiers for visual feedback
  skillManager.setTileColorModifier(targetAllyHexId, reinierSkill.tileColorModifier!)
  skillManager.setTileColorModifier(targetEnemyHexId, reinierSkill.tileColorModifier!)
}

export const reinierSkill: Skill = {
  id: 'reinier',
  characterId: 31,
  name: 'Dynamic Balance',
  description:
    'Targets an adjacent ally position with an enemy hero if both the ally and enemy are placed on a symmetrical tile.',
  tileColorModifier: '#9925be', // Skill border color for visual feedback

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
