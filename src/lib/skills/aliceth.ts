import { getOpposingTeam } from '../characters/character'
import type { Skill, SkillContext, SkillTargetInfo } from './skill'
import { findTarget, rowScan, searchByRow, TargetingMethod } from './utils/targeting'

/**
 * Calculate the ally target for Aliceth's skill.
 * First checks for allies in the same row, then expands outward if none found.
 */
function calculateAllyTarget(context: SkillContext): SkillTargetInfo | null {
  // Phase 1: Search for allies in the same diagonal row (on same team as Aliceth)
  const rowTarget = searchByRow(context, context.team)
  if (rowTarget) {
    return rowTarget
  }

  // Phase 2: If no allies in same row, scan outward from adjacent tiles
  return rowScan(context, context.team)
}

/**
 * Calculate the enemy target for Aliceth's skill.
 * Targets the furthest enemy from Aliceth's position.
 */
function calculateEnemyTarget(context: SkillContext): SkillTargetInfo | null {
  return findTarget(context, {
    targetTeam: getOpposingTeam(context.team),
    targetingMethod: TargetingMethod.FURTHEST,
  })
}

/**
 * Calculate both ally and enemy targets for Aliceth's dual targeting skill.
 */
export function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const allyTarget = calculateAllyTarget(context)
  const enemyTarget = calculateEnemyTarget(context)

  // If no ally target, return null (no targeting at all)
  if (!allyTarget) {
    return null
  }

  // Build the combined target info with arrows array
  const targetInfo: SkillTargetInfo = {
    targetHexId: allyTarget.targetHexId,
    targetCharacterId: allyTarget.targetCharacterId,
    metadata: {
      ...allyTarget.metadata,
      arrows: [],
    },
  }

  // Add ally arrow
  if (allyTarget.targetHexId) {
    targetInfo.metadata!.arrows!.push({
      fromHexId: context.hexId,
      toHexId: allyTarget.targetHexId,
      type: 'ally',
    })
  }

  // Add enemy arrow if enemy target exists
  if (enemyTarget?.targetHexId) {
    targetInfo.metadata!.arrows!.push({
      fromHexId: context.hexId,
      toHexId: enemyTarget.targetHexId,
      type: 'enemy',
    })
  }

  return targetInfo
}

export const alicethSkill: Skill = {
  id: 'aliceth',
  characterId: 91,
  name: 'Guiding Light',
  description:
    'Aliceth targets the closest ally characters in the same row as her, prioritizing those on higher hex ID in case of a tie. If no character is found, Aliceth scans from the tiles adjacent to her, expanding outward from the highest hex ID to the lowest ID, targeting the first ally character found. Additionally, also target the enemy character on the opposing team that is furthest from the current tile of Aliceth.',
  targetingColorModifier: '#ffa000',

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
