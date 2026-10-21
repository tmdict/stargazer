/**
 * Spirit Mark: a phantimal marks the hero on its priority-behind (or
 * priority-front) tile, the same adjacent-tile priority Daimon uses. The mark
 * paints both tile channels (fill + border) in a yellow reserved for seasonal
 * marks, so they read apart from hero highlights. A mark paints only while the
 * phantimal's data file sets `"targeting": true`, so it can be written ahead of
 * its in-game unlock.
 *
 * The registry holds one skill per id, so a phantimal that already has a skill
 * (a companion) can't also take createSpiritMarkSkill. It draws its mark with
 * spiritMarkTiles inside whenSeasonalTargeting, in a withEffects over that skill.
 */
import { inPhantimalBand, toPhantimalId } from '../../characters/phantimal'
import type { Skill, SkillContext, TilePaint } from '../skill'
import { createEffectsSkill } from './builders'
import { SKILL_COLORS } from './colors'
import { findAdjacentPriorityTarget, type TargetDirection } from './targeting'

const SPIRIT_MARK_COLOR = SKILL_COLORS.gold

// A mark goes to a hero: a tile holding another phantimal or a phantimal's
// companion is skipped for the next tile in the chain.
const isMarkable = (characterId: number): boolean => !inPhantimalBand(characterId)

// One target computation feeds both paint channels.
export function spiritMarkTiles(ctx: SkillContext, direction: TargetDirection): TilePaint[] {
  const info = findAdjacentPriorityTarget(ctx, direction, isMarkable)
  if (!info?.targetHexId) return []
  return [
    { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR },
    { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR, fill: true },
  ]
}

export const whenSeasonalTargeting =
  (calculate: (ctx: SkillContext) => TilePaint[]) =>
  (ctx: SkillContext): TilePaint[] =>
    ctx.lookups.seasonalTargeting(ctx.characterId) ? calculate(ctx) : []

export function createSpiritMarkSkill(
  localId: number,
  name: string,
  direction: TargetDirection,
): Skill {
  const mark = whenSeasonalTargeting((ctx) => spiritMarkTiles(ctx, direction))
  return createEffectsSkill({
    id: `phantimal-${name}`,
    characterId: toPhantimalId(localId),
    calculate: (ctx) => ({ tiles: mark(ctx) }),
  })
}
