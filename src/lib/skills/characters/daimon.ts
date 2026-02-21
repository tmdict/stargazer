import { Team } from '../../types/team'
import { registerSkill } from '../registry'
import { type Skill, type SkillContext, type SkillTargetInfo } from '../skill'
import { getCandidates } from '../utils/targeting'

function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, hexId, characterId, team } = context
  const centerHex = grid.getHexById(hexId)
  if (!centerHex) return null

  // Get all adjacent tiles behind Daimon (lower hex ID for ally, higher for enemy)
  const allTiles = grid.getAllTiles()
  const behindHexIds = allTiles
    .filter((t) => {
      if (!t?.hex) return false
      const dist = centerHex.distance(t.hex)
      if (dist !== 1) return false
      const id = t.hex.getId()
      return team === Team.ALLY ? id < hexId : id > hexId
    })
    .map((t) => t.hex.getId())

  // Sort to build priority order:
  // Ally: lowest first, then highest of remaining, then last
  // Enemy: highest first, then lowest of remaining, then last
  behindHexIds.sort((a, b) => (team === Team.ALLY ? a - b : b - a))

  // Priority: [0] = directly behind (lowest/highest), then swap remaining so higher/lower comes first
  const priority: number[] = []
  if (behindHexIds.length > 0) priority.push(behindHexIds[0]!)
  if (behindHexIds.length === 3) {
    // Of the remaining two, pick higher ID first (ally) or lower ID first (enemy)
    priority.push(behindHexIds[2]!)
    priority.push(behindHexIds[1]!)
  } else if (behindHexIds.length === 2) {
    priority.push(behindHexIds[1]!)
  }

  // Build candidate lookup from allies on the grid
  const candidateMap = new Map(getCandidates(grid, team, characterId).map((c) => [c.hexId, c]))

  // Check tiles in priority order, return first occupied
  for (const tileId of priority) {
    const candidate = candidateMap.get(tileId)
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

function updateSkillTargets(context: SkillContext): void {
  const { skillManager, team, characterId } = context

  // Clear previous tile modifier
  const previousTarget = skillManager.getSkillTarget(characterId, team)
  if (previousTarget?.targetHexId) {
    skillManager.removeTileColorModifier(previousTarget.targetHexId, daimonSkill.tileColorModifier!)
  }

  const targetInfo = calculateTarget(context)
  if (targetInfo?.targetHexId) {
    skillManager.setSkillTarget(characterId, team, targetInfo)
    skillManager.setTileColorModifier(targetInfo.targetHexId, daimonSkill.tileColorModifier!)
  } else {
    skillManager.clearSkillTarget(characterId, team)
  }
}

const daimonSkill: Skill = {
  id: 'daimon',
  characterId: 81,
  name: 'Buddy Barrier',
  description:
    'Targets an ally on adjacent tiles behind him (lower hex ID for ally team, higher for enemy team). Prioritizes the tile directly behind first (lowest/highest hex ID), then the higher/lower of the two remaining tiles in the row behind.',
  tileColorModifier: '#6d9c86',

  onActivate(context: SkillContext): void {
    updateSkillTargets(context)
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    const currentTarget = skillManager.getSkillTarget(characterId, team)
    if (currentTarget?.targetHexId) {
      skillManager.removeTileColorModifier(
        currentTarget.targetHexId,
        daimonSkill.tileColorModifier!,
      )
    }

    skillManager.clearSkillTarget(characterId, team)
  },

  onUpdate(context: SkillContext): void {
    updateSkillTargets(context)
  },
}

registerSkill(daimonSkill)
