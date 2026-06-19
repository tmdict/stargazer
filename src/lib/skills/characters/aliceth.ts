import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import type { SkillContext, SkillTargetInfo } from '../skill'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'
import { rowScan, ScanDirection, searchByRow } from '../utils/ring'

// Aliceth first targets a same-team unit in her own diagonal row (searchByRow),
// then falls back to a row scan outward. The fallback reuses rowScan, walking from
// her front rows toward her back and taking the front of each row first; her own
// row is necessarily empty when the fallback runs, so it needs no exclusion.
function calculateAllyTarget(context: SkillContext): SkillTargetInfo | null {
  return (
    searchByRow(context, context.team) ??
    rowScan(context, { team: context.team, rowDirection: ScanDirection.FRONTMOST })
  )
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

// Targets the closest ally in the same row (highest hex ID on a tie), falling
// back to an outward scan, and also targets the furthest enemy.
registerSkill(
  createTargetingSkill({
    id: 'aliceth',
    characterId: 91,
    color: '#ffa000',
    calculateTarget,
  }),
)
