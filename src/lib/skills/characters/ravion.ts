import { registerSkill } from '../registry'
import { type Skill, type SkillContext, type SkillTargetInfo } from '../skill'
import { getCandidates } from '../utils/targeting'

/**
 * Calculate the target info with arrows to 2 rearmost allies
 */
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, characterId, hexId } = context

  // Get all ally candidates excluding self
  const candidates = getCandidates(grid, team, characterId)

  if (candidates.length === 0) return null

  // Sort by hex ID ascending (smallest = rearmost for allies)
  const sorted = [...candidates].sort((a, b) => a.hexId - b.hexId)

  // Take the 2 rearmost (smallest hex IDs for allies)
  const targets = sorted.slice(0, 2)

  // Build target info with multiple arrows
  // Set targetHexId/targetCharacterId to null since actual targets are in arrows array
  const targetInfo: SkillTargetInfo = {
    targetHexId: null,
    targetCharacterId: null,
    metadata: {
      arrows: targets.map((target) => ({
        fromHexId: hexId,
        toHexId: target.hexId,
        type: 'ally' as const,
      })),
      examinedTiles: candidates.map((c) => c.hexId),
      isRearmostTarget: true,
    },
  }

  return targetInfo
}

const ravionSkill: Skill = {
  id: 'ravion',
  characterId: 90,
  name: 'Designated Duty',
  description: 'Targets the 2 rearmost ally characters on the same team.',
  targetingColorModifier: '#6d9c86',

  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Calculate target with multiple arrows
    const targetInfo = calculateTarget(context)
    if (targetInfo) {
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

registerSkill(ravionSkill)
