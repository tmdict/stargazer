/**
 * Factories for skills that share a calculate-and-store lifecycle.
 *
 * Both factories wire up the standard activate/deactivate/update hooks
 * around a single `calculateTarget` callback; they differ only in how
 * the result is presented:
 *   - createTargetingSkill: optionally enriches the target with arrow metadata
 *   - createTileHighlightSkill: paints a color modifier on the target tile,
 *     with previous-target cleanup on update
 */

import type { Skill, SkillContext, SkillTargetInfo } from '../skill'

interface TargetingSkillConfig {
  id: string
  characterId: number
  name: string
  description: string
  color: string
  /**
   * If set, the factory wraps the calculated target with a single arrow
   * pointing from the caster's hex to the target. Omit for skills that
   * build their own arrows (e.g. multi-target skills like Ravion).
   */
  arrowType?: 'ally' | 'enemy'
  calculateTarget: (context: SkillContext) => SkillTargetInfo | null
}

/**
 * Skill that calculates a target and stores it via skillManager.
 * Optionally enriches the target with a single arrow.
 */
export function createTargetingSkill(config: TargetingSkillConfig): Skill {
  const { id, characterId, name, description, color, arrowType, calculateTarget } = config

  const isHit = (info: SkillTargetInfo | null): info is SkillTargetInfo => {
    if (info === null) return false
    // When arrowType is set, target must have a concrete hex to point at.
    // Otherwise the caller is expected to populate arrows itself.
    return arrowType === undefined || info.targetHexId !== null
  }

  const apply = (ctx: SkillContext, info: SkillTargetInfo): void => {
    const enriched =
      arrowType !== undefined && info.targetHexId !== null
        ? {
            ...info,
            metadata: {
              ...info.metadata,
              arrows: [{ fromHexId: ctx.hexId, toHexId: info.targetHexId, type: arrowType }],
            },
          }
        : info
    ctx.skillManager.setSkillTarget(characterId, ctx.team, enriched)
  }

  return {
    id,
    characterId,
    name,
    description,
    targetingColorModifier: color,
    onActivate(ctx) {
      const info = calculateTarget(ctx)
      if (isHit(info)) apply(ctx, info)
    },
    onDeactivate(ctx) {
      ctx.skillManager.clearSkillTarget(characterId, ctx.team)
    },
    onUpdate(ctx) {
      const info = calculateTarget(ctx)
      if (isHit(info)) apply(ctx, info)
      else ctx.skillManager.clearSkillTarget(characterId, ctx.team)
    },
  }
}

interface TileHighlightSkillConfig {
  id: string
  characterId: number
  name: string
  description: string
  tileColor: string
  calculateTarget: (context: SkillContext) => SkillTargetInfo | null
}

/**
 * Skill that highlights a single tile with a color modifier.
 * Tracks the previously highlighted tile so its modifier is cleaned up
 * before applying the new one.
 */
export function createTileHighlightSkill(config: TileHighlightSkillConfig): Skill {
  const { id, characterId, name, description, tileColor, calculateTarget } = config

  const updateTargets = (ctx: SkillContext): void => {
    const { skillManager, team } = ctx

    // Clear previous tile color before applying new one
    const previous = skillManager.getSkillTarget(characterId, team)
    if (previous?.targetHexId) {
      skillManager.removeTileColorModifier(previous.targetHexId, tileColor)
    }

    const info = calculateTarget(ctx)
    if (info?.targetHexId) {
      skillManager.setSkillTarget(characterId, team, info)
      skillManager.setTileColorModifier(info.targetHexId, tileColor)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  }

  return {
    id,
    characterId,
    name,
    description,
    onActivate(ctx) {
      updateTargets(ctx)
    },
    onDeactivate(ctx) {
      const { skillManager, team } = ctx
      const current = skillManager.getSkillTarget(characterId, team)
      if (current?.targetHexId) {
        skillManager.removeTileColorModifier(current.targetHexId, tileColor)
      }
      skillManager.clearSkillTarget(characterId, team)
    },
    onUpdate(ctx) {
      updateTargets(ctx)
    },
  }
}
