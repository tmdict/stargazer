import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import type { SkillContext, SkillTargetInfo } from '../skill'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'
import { rowScan, searchByRow } from '../utils/ring'

// Search for allies in same diagonal row first, then scan outward.
function calculateAllyTarget(context: SkillContext): SkillTargetInfo | null {
  return searchByRow(context, context.team) ?? rowScan(context, context.team)
}

function calculateEnemyTarget(context: SkillContext): SkillTargetInfo | null {
  return findTarget(context, {
    targetTeam: getOpposingTeam(context.team),
    targetingMethod: TargetingMethod.FURTHEST,
  })
}

// Aliceth targets both an ally and an enemy. Combine both into a single
// SkillTargetInfo with arrows for each, leaving targetHexId null since
// the actual targets are in the arrows array.
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const allyTarget = calculateAllyTarget(context)
  const enemyTarget = calculateEnemyTarget(context)

  if (!allyTarget && !enemyTarget) return null

  const arrows: NonNullable<SkillTargetInfo['metadata']>['arrows'] = []
  if (allyTarget?.targetHexId) {
    arrows.push({ fromHexId: context.hexId, toHexId: allyTarget.targetHexId, type: 'ally' })
  }
  if (enemyTarget?.targetHexId) {
    arrows.push({ fromHexId: context.hexId, toHexId: enemyTarget.targetHexId, type: 'enemy' })
  }

  return {
    targetHexId: null,
    targetCharacterId: null,
    metadata: {
      ...(allyTarget?.metadata || {}),
      ...(enemyTarget?.metadata || {}),
      arrows,
    },
  }
}

registerSkill(
  createTargetingSkill({
    id: 'aliceth',
    characterId: 91,
    name: 'Guiding Light',
    description:
      'Aliceth targets the closest ally characters in the same row as her, prioritizing those on higher hex ID in case of a tie. If no character is found, Aliceth scans from the tiles adjacent to her, expanding outward from the highest hex ID to the lowest ID, targeting the first ally character found. Additionally, also target the enemy character on the opposing team that is furthest from the current tile of Aliceth.',
    color: '#ffa000',
    calculateTarget,
  }),
)
