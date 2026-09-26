/**
 * Seasonal phantimal skills.
 *
 * Spirit Mark: a phantimal marks the hero on its priority-behind (or
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
import { findCharacterHex } from '../../characters/character'
import { getCompanions } from '../../characters/companion'
import { inPhantimalBand, toPhantimalId } from '../../characters/phantimal'
import { registerSkill } from '../registry'
import type { Skill, SkillContext, TilePaint } from '../skill'
import { createCompanionSkill, withTilePaint } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { findAdjacentPriorityTarget, type TargetDirection } from '../utils/targeting'

const SPIRIT_MARK_COLOR = SKILL_COLORS.gold

// A mark goes to a hero: a tile holding another phantimal or a phantimal's
// companion is skipped for the next tile in the chain.
const isMarkable = (characterId: number): boolean => !inPhantimalBand(characterId)

// One target computation feeds both paint channels.
function markTiles(ctx: SkillContext, direction: TargetDirection): TilePaint[] {
  const info = findAdjacentPriorityTarget(ctx, direction, isMarkable)
  if (!info?.targetHexId) return []
  return [
    { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR },
    { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR, fill: true },
  ]
}

const whenTargeting =
  (calculate: (ctx: SkillContext) => TilePaint[]) =>
  (ctx: SkillContext): TilePaint[] =>
    ctx.lookups?.seasonalTargeting?.(ctx.characterId) ? calculate(ctx) : []

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
  return withTilePaint(
    base,
    whenTargeting((ctx) => markTiles(ctx, direction)),
  )
}

const spiritMarks: { localId: number; name: string; direction: TargetDirection }[] = [
  { localId: 1, name: 'gervan', direction: 'front' },
  { localId: 2, name: 'seralyth', direction: 'behind' },
  { localId: 3, name: 'crystal-beetle', direction: 'front' },
  { localId: 4, name: 'plague-creeper', direction: 'front' },
]

for (const { localId, name, direction } of spiritMarks) {
  registerSkill(createSpiritMarkSkill(localId, name, direction))
}

// Each wedge marks a hero of its own: Wedge of Matter the one in front of it,
// Wedge of Power the one behind its own tile, so that mark follows the
// companion wherever it stands.
function wedgeMarkTiles(ctx: SkillContext): TilePaint[] {
  const tiles = markTiles(ctx, 'front')
  for (const companionId of getCompanions(ctx.grid, ctx.characterId, ctx.team)) {
    const hexId = findCharacterHex(ctx.grid, companionId, ctx.team)
    if (hexId !== null) {
      tiles.push(...markTiles({ ...ctx, hexId, characterId: companionId }, 'behind'))
    }
  }
  return tiles
}

// Wedge of Matter enters with Wedge of Power on a random free tile of its
// team; removing either removes both. Neither wedge holds a team slot, and
// Wedge of Power targets at range 20 under its own portrait.
registerSkill(
  withTilePaint(
    createCompanionSkill({
      id: 'phantimal-wedge-of-matter',
      characterId: toPhantimalId(5),
      raisesCapacity: false,
      companionImageModifier: 'wedge-of-power',
      companionRange: 20,
    }),
    whenTargeting(wedgeMarkTiles),
  ),
)
