import type { Skill, SkillContext, SkillTargetInfo } from '../skill'
import type { Grid } from '../grid'
import { Team } from '../types/team'
import { calculateDistances } from './utils/targeting'

// Get all characters on the same team (excluding self)
function getSameTeamCharacters(grid: Grid, team: Team, excludeCharacterId: number) {
  const candidates: Array<{
    hexId: number
    characterId: number
    distances: Map<number, number>
  }> = []

  for (const tile of grid.getAllTiles()) {
    // Skip tiles without characters or with different team
    if (!tile.characterId || tile.team !== team) continue

    // Skip self (Dunlingr)
    if (tile.characterId === excludeCharacterId) continue

    candidates.push({
      hexId: tile.hex.getId(),
      characterId: tile.characterId,
      distances: new Map(),
    })
  }

  return candidates
}

// Calculate the furthest same-team target from Dunlingr's position
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, hexId, characterId } = context

  // Get all same team characters (excluding Dunlingr himself)
  const candidates = getSameTeamCharacters(grid, team, characterId)
  if (candidates.length === 0) return null

  // Track examined tiles for debug info
  const examinedTiles: number[] = []

  // Calculate distances from Dunlingr's current position
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
      return b.distance - a.distance // Furthest wins
    }

    // Tie-breaking: team-aware hex ID preference
    // Ally Dunlingr targeting allies: prefer lower hex ID
    // Enemy Dunlingr targeting enemies: prefer higher hex ID (180° rotation)
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

export const dunlingrSkill: Skill = {
  id: 'dunlingr',
  characterId: 57,
  name: 'Bell of Order',
  description:
    'Targets the character on the same team that is furthest from the current tile of Dunlingr.',
  targetingColorModifier: '#facc15', // Yellow color for ally targeting

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
