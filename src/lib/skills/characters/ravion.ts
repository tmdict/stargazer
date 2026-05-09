import { registerSkill } from '../registry'
import type { SkillContext, SkillTargetInfo } from '../skill'
import { createTargetingSkill } from '../utils/builders'
import { getCandidates } from '../utils/targeting'

// Targets the 2 rearmost allies (smallest hex IDs) with arrows for each.
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, characterId, hexId } = context
  const candidates = getCandidates(grid, team, characterId)
  if (candidates.length === 0) return null

  const sorted = [...candidates].sort((a, b) => a.hexId - b.hexId)
  const targets = sorted.slice(0, 2)

  return {
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
}

registerSkill(
  createTargetingSkill({
    id: 'ravion',
    characterId: 90,
    name: 'Designated Duty',
    description: 'Targets the 2 rearmost ally characters on the same team.',
    color: '#6d9c86',
    calculateTarget,
  }),
)
