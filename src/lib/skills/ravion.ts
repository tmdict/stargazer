import type { Skill, SkillContext, SkillTargetInfo } from './skill'
import { getCandidates } from './utils/targeting'

/**
 * Calculate the 2 rearmost allies for Ravion to target
 * Returns an array of up to 2 targets, sorted by hex ID (rearmost first)
 */
function calculateTargets(context: SkillContext): SkillTargetInfo[] {
  const { grid, team, characterId, hexId } = context

  // Get all ally candidates excluding self
  const candidates = getCandidates(grid, team, characterId)

  if (candidates.length === 0) return []

  // Sort by hex ID ascending (smallest = rearmost for allies)
  const sorted = [...candidates].sort((a, b) => a.hexId - b.hexId)

  // Take the 2 rearmost (smallest hex IDs for allies)
  const targets = sorted.slice(0, 2)

  // Convert to SkillTargetInfo format
  return targets.map((candidate) => ({
    targetHexId: candidate.hexId,
    targetCharacterId: candidate.characterId,
    metadata: {
      sourceHexId: hexId,
      examinedTiles: candidates.map((c) => c.hexId),
      isRearmostTarget: true,
    },
  }))
}

export const ravionSkill: Skill = {
  id: 'ravion',
  characterId: 90,
  name: 'Designated Duty',
  description: 'Targets the 2 rearmost ally characters on the same team.',
  targetingColorModifier: '#6d9c86',

  /**
   * Multi-target Implementation:
   * Since the skill system stores one target per characterId-team key, we use
   * decimal indexing to store multiple targets. For example, character 90 becomes:
   * - 90.1 for first target
   * - 90.2 for second target
   * This allows multiple arrows to render without changing the core system.
   */
  onActivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Calculate targets
    const targets = calculateTargets(context)

    // Store each target with an indexed key
    targets.forEach((targetInfo, index) => {
      // Use indexed character ID to store multiple targets
      // Adding 0.1 * (index + 1) to avoid collision with actual character IDs
      const indexedCharacterId = characterId + (index + 1) * 0.1
      skillManager.setSkillTarget(indexedCharacterId, team, targetInfo)
    })
  },

  onDeactivate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Clear all targets (up to 2)
    for (let i = 1; i <= 2; i++) {
      const indexedCharacterId = characterId + i * 0.1
      skillManager.clearSkillTarget(indexedCharacterId, team)
    }
  },

  onUpdate(context: SkillContext): void {
    const { team, skillManager, characterId } = context

    // Clear old targets first
    for (let i = 1; i <= 2; i++) {
      const indexedCharacterId = characterId + i * 0.1
      skillManager.clearSkillTarget(indexedCharacterId, team)
    }

    // Recalculate targets on any grid change
    const targets = calculateTargets(context)

    // Set new targets
    targets.forEach((targetInfo, index) => {
      const indexedCharacterId = characterId + (index + 1) * 0.1
      skillManager.setSkillTarget(indexedCharacterId, team, targetInfo)
    })
  },
}
