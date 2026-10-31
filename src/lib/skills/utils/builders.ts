/**
 * Factories for skills that share a common lifecycle.
 *
 * createTargetingSkill and createTileHighlightSkill wire the standard
 * activate/deactivate/update hooks around a single `calculateTarget`
 * callback; they differ only in how the result is presented:
 *   - createTargetingSkill: optionally enriches the target with arrow metadata
 *   - createTileHighlightSkill: paints a color modifier on the target tile,
 *     with previous-target cleanup on update
 *
 * createEffectsSkill covers skills whose whole behavior is drawing tile paints,
 * lines and unit badges (withEffects over an otherwise empty lifecycle).
 *
 * createCompanionSkill owns the companion lifecycle instead: spawning N
 * companions on random free tiles, raising team capacity, linking them to
 * the main character, and tearing all of it down on deactivation.
 */

import { findCharacterHex, getMaxTeamSize, setMaxTeamSize } from '../../characters/character'
import { addCompanionLink, clearCompanionLinks, getCompanions } from '../../characters/companion'
import { performPlace } from '../../characters/place'
import { performRemove } from '../../characters/remove'
import { BASE_TEAM_SIZE } from '../../grid'
import { State } from '../../types/state'
import { Team } from '../../types/team'
import type {
  Skill,
  SkillBadge,
  SkillContext,
  SkillLine,
  SkillTargetInfo,
  TilePaint,
} from '../skill'

interface TargetingSkillConfig {
  id: string
  characterId: number
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
 *
 * Instance state in every factory keys by ctx.characterId (the placed unit),
 * never the config id: a synergy copy shares one Skill object with its base
 * hero, and config-keyed state would cross-wire the two instances. Hence no
 * factory destructures characterId out of its config; it appears only as the
 * returned object's registry field.
 */
export function createTargetingSkill(config: TargetingSkillConfig): Skill {
  const { id, color, arrowType, calculateTarget } = config

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
    ctx.skillManager.setSkillTarget(ctx.characterId, ctx.team, enriched)
  }

  return {
    id,
    characterId: config.characterId,
    targetingColorModifier: color,
    onActivate(ctx) {
      const info = calculateTarget(ctx)
      if (isHit(info)) apply(ctx, info)
    },
    onDeactivate(ctx) {
      ctx.skillManager.clearSkillTarget(ctx.characterId, ctx.team)
    },
    onUpdate(ctx) {
      const info = calculateTarget(ctx)
      if (isHit(info)) apply(ctx, info)
      else ctx.skillManager.clearSkillTarget(ctx.characterId, ctx.team)
    },
  }
}

interface TileHighlightSkillConfig {
  id: string
  characterId: number
  tileColor: string
  /** Paint the target's cell fill (a tint) instead of its border. */
  fill?: boolean
  calculateTarget: (context: SkillContext) => SkillTargetInfo | null
}

/** Skill that highlights a single tile with a color modifier. */
export function createTileHighlightSkill(config: TileHighlightSkillConfig): Skill {
  const { id, tileColor, fill, calculateTarget } = config

  const updateTargets = (ctx: SkillContext): void => {
    const { skillManager, team, characterId } = ctx
    const info = calculateTarget(ctx)
    if (info?.targetHexId) {
      skillManager.setSkillTarget(characterId, team, info)
      skillManager.paintTiles(characterId, team, [
        { hexId: info.targetHexId, color: tileColor, fill },
      ])
    } else {
      skillManager.clearSkillTarget(characterId, team)
      skillManager.clearPaintedTiles(characterId, team)
    }
  }

  return {
    id,
    characterId: config.characterId,
    onActivate(ctx) {
      updateTargets(ctx)
    },
    onDeactivate({ skillManager, team, characterId }) {
      skillManager.clearPaintedTiles(characterId, team)
      skillManager.clearSkillTarget(characterId, team)
    },
    onUpdate(ctx) {
      updateTargets(ctx)
    },
  }
}

// What a skill draws for the current grid state. A channel left out is not
// written, so two decorators on one skill never overwrite each other.
interface SkillEffects {
  tiles?: TilePaint[]
  lines?: SkillLine[]
  badges?: SkillBadge[]
}

/**
 * Decorates a skill with the tile paints, lines and unit badges `calculate`
 * returns. They are written after the base skill's own hooks on activate and
 * update and cleared before its deactivate, so a skill that owns other behavior
 * (a target, companions) can draw too, since the registry allows one skill per
 * character. Effects from one computation are returned together, so it runs once.
 */
export function withEffects(
  base: Skill,
  calculate: (context: SkillContext) => SkillEffects,
): Skill {
  const draw = (ctx: SkillContext): void => {
    const { tiles, lines, badges } = calculate(ctx)
    const { skillManager, characterId, team } = ctx
    if (tiles) skillManager.paintTiles(characterId, team, tiles)
    if (lines) skillManager.setSkillLines(characterId, team, lines)
    if (badges) skillManager.setSkillBadges(characterId, team, badges)
  }
  return {
    ...base,
    onActivate(ctx) {
      base.onActivate(ctx)
      draw(ctx)
    },
    onUpdate(ctx) {
      base.onUpdate?.(ctx)
      draw(ctx)
    },
    // Every channel is cleared whichever ones `calculate` filled, because the
    // instance is going away.
    onDeactivate(ctx) {
      const { skillManager, characterId, team } = ctx
      skillManager.clearPaintedTiles(characterId, team)
      skillManager.clearSkillLines(characterId, team)
      skillManager.clearSkillBadges(characterId, team)
      base.onDeactivate(ctx)
    },
  }
}

interface EffectsSkillConfig {
  id: string
  characterId: number
  calculate: (context: SkillContext) => SkillEffects
}

/** Skill whose only behavior is drawing the effects `calculate` returns. */
export function createEffectsSkill(config: EffectsSkillConfig): Skill {
  const { id, characterId, calculate } = config
  return withEffects({ id, characterId, onActivate() {}, onDeactivate() {} }, calculate)
}

interface CompanionSkillConfig {
  id: string
  characterId: number
  /** Number of companions to spawn; each raises team capacity by one. */
  count?: number
  /** False for an owner that holds no team slot (a phantimal): its companions
   * hold none either, so capacity stays put. */
  raisesCapacity?: boolean
  /** The owner's picture on a board, when not its portrait. */
  imageModifier?: string
  /** The companions' picture on a board, which tells them from their owner. */
  companionImageModifier: string
  companionRange?: number
}

/**
 * Skill that spawns companion units on random free tiles.
 *
 * Activation raises the team capacity by `count`, places the companions
 * (IDs namespaced as N * companionIdOffset + characterId), links them to the
 * main character, and gives them their picture. A placement failure
 * rolls back already-placed companions and the capacity bump, then throws so
 * the surrounding placement transaction fails as a whole. Deactivation
 * removes the companions, their links and pictures, and restores capacity.
 */
export function createCompanionSkill(config: CompanionSkillConfig): Skill {
  const {
    id,
    count = 1,
    raisesCapacity = true,
    imageModifier,
    companionImageModifier,
    companionRange,
  } = config

  return {
    id,
    characterId: config.characterId,
    companionCount: count,
    imageModifier,
    companionImageModifier,
    companionRange,

    onActivate(ctx: SkillContext): void {
      const { grid, team, skillManager, characterId } = ctx
      const companionIds = Array.from(
        { length: count },
        (_, i) => (i + 1) * grid.companionIdOffset + characterId,
      )

      const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
      const availableTiles = grid
        .getAllTiles()
        .filter((tile) => tile.state === availableState && !tile.characterId)

      if (availableTiles.length < count) {
        // Throwing makes the surrounding placement transaction fail as a whole
        throw new Error(`${id}: not enough free tiles for ${count} companion(s)`)
      }

      const baseSize = getMaxTeamSize(grid, team)
      if (raisesCapacity && !setMaxTeamSize(grid, team, baseSize + count)) {
        console.warn(`${id}: failed to increase team size for ${team}`)
        return // Skip companion placement
      }

      const rollback = (placed: number[]): void => {
        for (const placedId of placed) {
          const hexId = findCharacterHex(grid, placedId, team)
          if (hexId !== null) performRemove(grid, hexId)
        }
        if (raisesCapacity) setMaxTeamSize(grid, team, baseSize)
      }

      const placedCompanions: number[] = []
      for (const companionId of companionIds) {
        const randomIndex = Math.floor(Math.random() * availableTiles.length)
        const tile = availableTiles[randomIndex]
        if (!tile || !performPlace(grid, tile.hex.getId(), companionId, team)) {
          rollback(placedCompanions)
          throw new Error(`${id}: failed to place companion ${companionId}`)
        }
        placedCompanions.push(companionId)
        availableTiles.splice(randomIndex, 1)

        addCompanionLink(grid, characterId, companionId, team)
        skillManager.addCharacterImageModifier(companionId, team, companionImageModifier)
      }
    },

    onDeactivate(ctx: SkillContext): void {
      const { grid, team, skillManager, characterId } = ctx

      for (const companionId of getCompanions(grid, characterId, team)) {
        const companionHex = findCharacterHex(grid, companionId, team)
        if (companionHex !== null) {
          skillManager.removeCharacterImageModifier(companionId, team)
          if (!performRemove(grid, companionHex)) {
            console.warn(
              `${id}: failed to remove companion ${companionId} from hex ${companionHex}`,
            )
          }
        }
      }

      clearCompanionLinks(grid, characterId, team)
      if (!raisesCapacity) return

      // Restore capacity, clamped to the base size
      const currentSize = getMaxTeamSize(grid, team)
      if (!setMaxTeamSize(grid, team, Math.max(BASE_TEAM_SIZE, currentSize - count))) {
        console.warn(`${id}: failed to restore team size for ${team}`)
      }
    },
  }
}
