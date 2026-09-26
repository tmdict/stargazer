/**
 * Seasonal phantimal skills.
 *
 * Spirit Mark: a phantimal marks the unit on its priority-behind (or
 * priority-front) tile, the same adjacent-tile priority Daimon uses. The mark
 * paints both tile channels (fill + border) in a yellow reserved for seasonal
 * marks, so they read apart from hero highlights. `spiritMarks` lists the
 * season's marks, which paint only while the phantimal's data file sets
 * `"targeting": true`, so a mark can be written ahead of its in-game unlock.
 * The registry holds one skill per id, so a phantimal that already has a skill
 * (a companion) takes its mark as withTilePaint over that skill instead.
 *
 * Every registration's id is `phantimal-<slug>` of the phantimal its id holds;
 * a data-contract test fails when the slug no longer matches, which catches
 * this file left unreplaced at a cutover.
 *
 * Retirement: replace this file's season entries and their cases in
 * tests/unit/skills/phantimal.test.ts in the same step as the phantimal
 * data/locale JSONs; retired IDs restored from old URLs still place, and would
 * otherwise keep activating the old season's skills. The ./seasonal/*.ts glob
 * in skill.ts is inert once this directory is empty.
 */
import { toPhantimalId } from '../../characters/phantimal'
import { registerSkill } from '../registry'
import type { Skill, SkillContext, TilePaint } from '../skill'
import { createCompanionSkill, withTilePaint } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { findAdjacentPriorityTarget, type TargetDirection } from '../utils/targeting'

const SPIRIT_MARK_COLOR = SKILL_COLORS.gold

// One target computation feeds both paint channels.
function spiritMarkTiles(direction: TargetDirection) {
  return (ctx: SkillContext): TilePaint[] => {
    if (!ctx.lookups?.seasonalTargeting?.(ctx.characterId)) return []
    const info = findAdjacentPriorityTarget(ctx, direction)
    if (!info?.targetHexId) return []
    return [
      { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR },
      { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR, fill: true },
    ]
  }
}

export function createSpiritMarkSkill(
  localId: number,
  name: string,
  direction: TargetDirection,
): Skill {
  const base: Skill = {
    id: `phantimal-${name}`,
    characterId: toPhantimalId(localId),
    onActivate() {},
    onDeactivate() {},
  }
  return withTilePaint(base, spiritMarkTiles(direction))
}

const spiritMarks: { localId: number; name: string; direction: TargetDirection }[] = []

for (const { localId, name, direction } of spiritMarks) {
  registerSkill(createSpiritMarkSkill(localId, name, direction))
}

// Wedge of Matter enters with Wedge of Power on a random free tile of its
// team; removing either removes both. Like their phantimal, neither holds a
// team slot, and Wedge of Power targets at range 20 under its own portrait.
registerSkill(
  createCompanionSkill({
    id: 'phantimal-wedge-of-matter',
    characterId: toPhantimalId(5),
    raisesCapacity: false,
    companionImageModifier: 'wedge-of-power',
    companionRange: 20,
  }),
)
