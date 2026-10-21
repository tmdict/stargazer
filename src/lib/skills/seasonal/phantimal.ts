/**
 * Seasonal phantimal skills. `spiritMarks` lists the season's Spirit Marks
 * (utils/spiritMark.ts), which paint only while the phantimal's data file sets
 * `"targeting": true`, so a mark can be written ahead of its in-game unlock.
 *
 * Every registration's id is `phantimal-<slug>` of the phantimal its id holds;
 * a data-contract test fails when the slug no longer matches, which catches
 * this file left unreplaced at a cutover.
 *
 * Retirement: replace this file and tests/unit/skills/phantimal.test.ts in the
 * same step as the phantimal data/locale JSONs; retired IDs restored from old
 * URLs still place, and would otherwise keep activating the old season's
 * skills. The ./seasonal/*.ts glob in skill.ts is inert once this directory is
 * empty.
 */
import { findCharacterHex } from '../../characters/character'
import { getCompanions } from '../../characters/companion'
import { toPhantimalId } from '../../characters/phantimal'
import { registerSkill } from '../registry'
import type { SkillContext, TilePaint } from '../skill'
import { createCompanionSkill, withEffects } from '../utils/builders'
import { createSpiritMarkSkill, spiritMarkTiles, whenSeasonalTargeting } from '../utils/spiritMark'
import type { TargetDirection } from '../utils/targeting'

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
  const tiles = spiritMarkTiles(ctx, 'front')
  for (const companionId of getCompanions(ctx.grid, ctx.characterId, ctx.team)) {
    const hexId = findCharacterHex(ctx.grid, companionId, ctx.team)
    if (hexId !== null) {
      tiles.push(...spiritMarkTiles({ ...ctx, hexId, characterId: companionId }, 'behind'))
    }
  }
  return tiles
}

const wedgeMarks = whenSeasonalTargeting(wedgeMarkTiles)

// Wedge of Matter enters with Wedge of Power on a random free tile of its
// team; removing either removes both. Neither wedge holds a team slot, and
// Wedge of Power targets at range 20 under its own portrait.
registerSkill(
  withEffects(
    createCompanionSkill({
      id: 'phantimal-wedge-of-matter',
      characterId: toPhantimalId(5),
      raisesCapacity: false,
      companionImageModifier: 'wedge-of-power',
      companionRange: 20,
    }),
    (ctx) => ({ tiles: wedgeMarks(ctx) }),
  ),
)
