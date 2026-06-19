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
import type { Skill, SkillContext, SkillLine, SkillTargetInfo, TilePaint } from '../skill'

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
 */
export function createTargetingSkill(config: TargetingSkillConfig): Skill {
  const { id, characterId, color, arrowType, calculateTarget } = config

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
  tileColor: string
  /** Paint the target's cell fill (a tint) instead of its border. */
  fill?: boolean
  calculateTarget: (context: SkillContext) => SkillTargetInfo | null
}

/**
 * Skill that highlights a single tile with a color modifier.
 * Tracks the previously highlighted tile so its modifier is cleaned up
 * before applying the new one.
 */
export function createTileHighlightSkill(config: TileHighlightSkillConfig): Skill {
  const { id, characterId, tileColor, fill, calculateTarget } = config

  const paint = (sm: SkillContext['skillManager'], hexId: number): void =>
    fill ? sm.setTileFillModifier(hexId, tileColor) : sm.setTileColorModifier(hexId, tileColor)
  const unpaint = (sm: SkillContext['skillManager'], hexId: number): void =>
    fill
      ? sm.removeTileFillModifier(hexId, tileColor)
      : sm.removeTileColorModifier(hexId, tileColor)

  const updateTargets = (ctx: SkillContext): void => {
    const { skillManager, team } = ctx

    // Clear previous tile color before applying new one
    const previous = skillManager.getSkillTarget(characterId, team)
    if (previous?.targetHexId) {
      unpaint(skillManager, previous.targetHexId)
    }

    const info = calculateTarget(ctx)
    if (info?.targetHexId) {
      skillManager.setSkillTarget(characterId, team, info)
      paint(skillManager, info.targetHexId)
    } else {
      skillManager.clearSkillTarget(characterId, team)
    }
  }

  return {
    id,
    characterId,
    onActivate(ctx) {
      updateTargets(ctx)
    },
    onDeactivate(ctx) {
      const { skillManager, team } = ctx
      const current = skillManager.getSkillTarget(characterId, team)
      if (current?.targetHexId) {
        unpaint(skillManager, current.targetHexId)
      }
      skillManager.clearSkillTarget(characterId, team)
    },
    onUpdate(ctx) {
      updateTargets(ctx)
    },
  }
}

/**
 * Decorates a skill with a tile-paint pass driven by `calculate`, which returns
 * the tiles (color, and border/fill channel) to highlight for the current grid state.
 *
 * Runs after the base skill's own hooks on activate/update, delegating the
 * set/remove/track diff to `skillManager.paintTiles` (cleared on deactivate). Lets
 * a skill that already owns other behavior (e.g. a companion skill) also paint
 * tiles, since the registry allows one skill per character.
 */
export function withTilePaint(
  base: Skill,
  calculate: (context: SkillContext) => TilePaint[],
): Skill {
  return {
    ...base,
    onActivate(ctx) {
      base.onActivate(ctx)
      ctx.skillManager.paintTiles(ctx.characterId, ctx.team, calculate(ctx))
    },
    onUpdate(ctx) {
      base.onUpdate?.(ctx)
      ctx.skillManager.paintTiles(ctx.characterId, ctx.team, calculate(ctx))
    },
    onDeactivate(ctx) {
      ctx.skillManager.clearPaintedTiles(ctx.characterId, ctx.team)
      base.onDeactivate(ctx)
    },
  }
}

/**
 * Decorates a skill with connection lines (drawn by SkillTargeting) computed by
 * `calculate`. The line analog of withTilePaint; clears on deactivate.
 */
export function withSkillLine(
  base: Skill,
  calculate: (context: SkillContext) => SkillLine[],
): Skill {
  return {
    ...base,
    onActivate(ctx) {
      base.onActivate(ctx)
      ctx.skillManager.setSkillLines(ctx.characterId, ctx.team, calculate(ctx))
    },
    onUpdate(ctx) {
      base.onUpdate?.(ctx)
      ctx.skillManager.setSkillLines(ctx.characterId, ctx.team, calculate(ctx))
    },
    onDeactivate(ctx) {
      ctx.skillManager.clearSkillLines(ctx.characterId, ctx.team)
      base.onDeactivate(ctx)
    },
  }
}

interface CompanionSkillConfig {
  id: string
  characterId: number
  /** Number of companions to spawn; each raises team capacity by one. */
  count?: number
  colorModifier?: string
  companionColorModifier?: string
  companionImageModifier?: string
  companionRange?: number
}

/**
 * Skill that spawns companion units on random free tiles.
 *
 * Activation raises the team capacity by `count`, places the companions
 * (IDs namespaced as N * companionIdOffset + characterId), links them to the
 * main character, and applies the configured modifiers. A placement failure
 * rolls back already-placed companions and the capacity bump, then throws so
 * the surrounding placement transaction fails as a whole. Deactivation
 * removes the companions, their links and modifiers, and restores capacity.
 */
export function createCompanionSkill(config: CompanionSkillConfig): Skill {
  const {
    id,
    characterId,
    count = 1,
    colorModifier,
    companionColorModifier,
    companionImageModifier,
    companionRange,
  } = config

  return {
    id,
    characterId,
    colorModifier,
    companionColorModifier,
    companionImageModifier,
    companionRange,

    onActivate(ctx: SkillContext): void {
      const { grid, team, skillManager } = ctx
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
      if (!setMaxTeamSize(grid, team, baseSize + count)) {
        console.warn(`${id}: failed to increase team size for ${team}`)
        return // Skip companion placement
      }

      const rollback = (placed: number[]): void => {
        for (const placedId of placed) {
          const hexId = findCharacterHex(grid, placedId, team)
          if (hexId !== null) performRemove(grid, hexId)
        }
        setMaxTeamSize(grid, team, baseSize)
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
        if (companionColorModifier) {
          skillManager.addCharacterColorModifier(companionId, team, companionColorModifier)
        }
        if (companionImageModifier) {
          skillManager.addCharacterImageModifier(companionId, team, companionImageModifier)
        }
      }

      if (colorModifier) {
        skillManager.addCharacterColorModifier(characterId, team, colorModifier)
      }
    },

    onDeactivate(ctx: SkillContext): void {
      const { grid, team, skillManager } = ctx

      skillManager.removeCharacterColorModifier(characterId, team)

      for (const companionId of getCompanions(grid, characterId, team)) {
        const companionHex = findCharacterHex(grid, companionId, team)
        if (companionHex !== null) {
          skillManager.removeCharacterColorModifier(companionId, team)
          skillManager.removeCharacterImageModifier(companionId, team)
          if (!performRemove(grid, companionHex)) {
            console.warn(
              `${id}: failed to remove companion ${companionId} from hex ${companionHex}`,
            )
          }
        }
      }

      clearCompanionLinks(grid, characterId, team)

      // Restore capacity, clamped to the base size
      const currentSize = getMaxTeamSize(grid, team)
      if (!setMaxTeamSize(grid, team, Math.max(BASE_TEAM_SIZE, currentSize - count))) {
        console.warn(`${id}: failed to restore team size for ${team}`)
      }
    },
  }
}
