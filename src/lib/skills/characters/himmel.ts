import { registerSkill } from '../registry'
import type { SkillContext, TilePaint } from '../skill'
import { createTilePaintSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { rowScan, ScanDirection } from '../utils/ring'

// One unit of each of these classes is highlighted; if any is absent among the
// neighbors the skill highlights nothing.
const REQUIRED_CLASSES = ['tank', 'mage', 'support']

// For each required class, the first adjacent same-team unit of that class under a
// row scan: diagonal rows from the team's back to front (REARMOST rows) and, within
// a row, the higher hex id first (FRONTMOST), bounded to the six neighbours by
// maxDistance 1. All three highlight only when every class is present. Companions
// count toward the trio by design: classOf resolves a summon to its main hero's
// class.
function computeHighlights(ctx: SkillContext): TilePaint[] {
  const tiles: TilePaint[] = []
  for (const className of REQUIRED_CLASSES) {
    const target = rowScan(ctx, {
      team: ctx.team,
      rowDirection: ScanDirection.REARMOST,
      withinRowDirection: ScanDirection.FRONTMOST,
      maxDistance: 1,
      filter: (characterId) => ctx.lookups?.classOf?.(characterId) === className,
    })
    if (!target?.targetHexId) return [] // a required class is missing: skill does not fire
    tiles.push({ hexId: target.targetHexId, color: SKILL_COLORS.blue, fill: true })
  }
  return tiles
}

registerSkill(
  createTilePaintSkill({
    id: 'himmel',
    characterId: 112,
    calculate: computeHighlights,
  }),
)
