import type { Skill, SkillContext, SkillTargetInfo } from '../skill'
import { Team } from '../types/team'
import { getOpposingCharacters, calculateDistances } from './utils/targeting'

// Calculate the furthest opposing target from Vala's position
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, hexId } = context

  // Get all opposing team characters
  const candidates = getOpposingCharacters(grid, team)
  if (candidates.length === 0) return null

  // Track examined tiles for debug info
  const examinedTiles: number[] = []

  // Calculate distances from Vala's current position
  calculateDistances(candidates, [hexId], grid)

  // Collect all candidate tiles with distances
  const candidatesWithDistance = candidates.map((c) => {
    const distance = c.distances.get(hexId) ?? 0
    examinedTiles.push(c.hexId)
    return { ...c, distance }
  })

  // Sort by distance (furthest first) with tie-breaking
  const sorted = candidatesWithDistance.sort((a, b) => {
    if (a.distance !== b.distance) {
      return b.distance - a.distance // Furthest wins (reversed from closest)
    }

    // Tie-breaking: team-aware hex ID preference
    // Ally Vala targeting enemies: prefer lower hex ID
    // Enemy Vala targeting allies: prefer higher hex ID (180° rotation)
    if (team === Team.ALLY) {
      return a.hexId - b.hexId // Lower hex ID wins for ally team
    } else {
      return b.hexId - a.hexId // Higher hex ID wins for enemy team
    }
  })

  const bestTarget = sorted[0]

  return {
    targetHexId: bestTarget.hexId,
    targetCharacterId: bestTarget.characterId,
    metadata: {
      sourceHexId: hexId,
      distance: bestTarget.distance,
      examinedTiles,
    },
  }
}

export const valaSkill: Skill = {
  id: 'vala',
  characterId: 46,
  name: 'Assassin',
  description:
    'Targets the character on the opposing team that is furthest from the current tile of Vala.',
  targetingColorModifier: '#7c3aed', // Purple color for Vala's targeting arrow

  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Calculate initial target
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
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
    const { team, skillManager, characterId } = context

    // Recalculate target on any grid change
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
      skillManager.setSkillTarget(characterId, team, targetInfo)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  },
}
