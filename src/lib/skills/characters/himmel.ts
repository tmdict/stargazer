import { registerSkill } from '../registry'
import type { SkillContext, TilePaint } from '../skill'
import { rowScan, ScanDirection } from '../utils/ring'

const TILE_COLOR = '#0288d1'

// One unit of each of these classes is highlighted; if any is absent among the
// neighbors the skill highlights nothing.
const REQUIRED_CLASSES = ['tank', 'mage', 'support']

// For each required class, the first adjacent same-team unit of that class under a
// row scan: diagonal rows from the team's back to front (REARMOST rows) and, within
// a row, the higher hex id first (FRONTMOST), bounded to the six neighbours by
// maxDistance 1. All three highlight only when every class is present.
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
    tiles.push({ hexId: target.targetHexId, color: TILE_COLOR, fill: true })
  }
  return tiles
}

registerSkill({
  id: 'himmel',
  characterId: 112,

  onActivate(ctx: SkillContext): void {
    ctx.skillManager.paintTiles(ctx.characterId, ctx.team, computeHighlights(ctx))
  },

  onDeactivate(ctx: SkillContext): void {
    ctx.skillManager.clearPaintedTiles(ctx.characterId, ctx.team)
  },

  onUpdate(ctx: SkillContext): void {
    ctx.skillManager.paintTiles(ctx.characterId, ctx.team, computeHighlights(ctx))
  },
})
