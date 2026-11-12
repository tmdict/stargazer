/**
 * Spirit Mark: a phantimal marks the unit on its priority-behind (or
 * priority-front) tile, the same adjacent-tile priority Daimon uses, and a
 * companion it spawned can carry a mark measured from its own tile. The mark
 * paints both tile channels (fill + border) in a yellow reserved for seasonal
 * marks, so they read apart from hero highlights. A mark paints only while the
 * phantimal's data file sets `"targeting": true`.
 *
 * Marks go out one at a time, the phantimal's first and then its companions',
 * each to the first unit in its chain that can take one: a hero or a hero's
 * companion, never a phantimal or a phantimal's companion. A unit holds one
 * mark, so a marked unit is passed over by the marks after it. Marked units
 * are told apart by tile: a placeholder's copies share one unit id.
 *
 * A team fields one phantimal, so one spiritMarkTiles call gives out all of a
 * team's marks. The registry holds one skill per id, so a phantimal that already
 * has a skill (a companion) can't also take createSpiritMarkSkill. It draws its
 * marks with spiritMarkTiles inside whenSeasonalTargeting, in a withEffects over
 * that skill.
 */
import { findCharacterHex } from '../../characters/character'
import { getCompanions } from '../../characters/companion'
import { inPhantimalBand, toPhantimalId } from '../../characters/phantimal'
import type { Skill, SkillContext, TilePaint } from '../skill'
import { createEffectsSkill } from './builders'
import { SKILL_COLORS } from './colors'
import { findAdjacentPriorityTarget, type TargetDirection } from './targeting'

const SPIRIT_MARK_COLOR = SKILL_COLORS.gold

export function spiritMarkTiles(
  ctx: SkillContext,
  direction: TargetDirection,
  companionDirection: TargetDirection = direction,
): TilePaint[] {
  const marked = new Set<number>()
  const mark = (from: SkillContext, chain: TargetDirection): TilePaint[] => {
    const info = findAdjacentPriorityTarget(
      from,
      chain,
      (unitId, hexId) => !inPhantimalBand(unitId) && !marked.has(hexId),
    )
    if (!info?.targetHexId || info.targetCharacterId === null) return []
    marked.add(info.targetHexId)
    const paint = { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR, source: from.characterId }
    return [paint, { ...paint, fill: true }]
  }
  const tiles = mark(ctx, direction)
  for (const companionId of getCompanions(ctx.grid, ctx.characterId, ctx.team)) {
    const hexId = findCharacterHex(ctx.grid, companionId, ctx.team)
    if (hexId !== null) {
      tiles.push(...mark({ ...ctx, hexId, characterId: companionId }, companionDirection))
    }
  }
  return tiles
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
