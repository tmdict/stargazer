import { registerSkill } from '../registry'
import type { SkillContext } from '../skill'
import { createTilePaintSkill, withSkillBadges } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { rowScan, ScanDirection } from '../utils/ring'

// One unit of each of these classes joins the party; if any is absent among the
// neighbors there is no party. Each class name is also its badge icon.
const REQUIRED_CLASSES = ['tank', 'mage', 'support'] as const

interface PartyMember {
  hexId: number
  className: (typeof REQUIRED_CLASSES)[number]
}

// For each required class, the first adjacent same-team unit of that class under a
// row scan: diagonal rows from the team's back to front (REARMOST rows) and, within
// a row, the higher hex id first (FRONTMOST), bounded to the six neighbours by
// maxDistance 1. The party forms only when every class is present. Companions
// count toward the trio by design: classOf resolves a summon to its main hero's
// class.
function party(ctx: SkillContext): PartyMember[] {
  const members: PartyMember[] = []
  for (const className of REQUIRED_CLASSES) {
    const target = rowScan(ctx, {
      team: ctx.team,
      rowDirection: ScanDirection.REARMOST,
      withinRowDirection: ScanDirection.FRONTMOST,
      maxDistance: 1,
      filter: (characterId) => ctx.lookups.classOf(characterId) === className,
    })
    if (!target?.targetHexId) return [] // a required class is missing: skill does not fire
    members.push({ hexId: target.targetHexId, className })
  }
  return members
}

// The party's tiles and its class badges both come from party(), so they always agree.
registerSkill(
  withSkillBadges(
    createTilePaintSkill({
      id: 'himmel',
      characterId: 112,
      calculate: (ctx) =>
        party(ctx).map(({ hexId }) => ({ hexId, color: SKILL_COLORS.blue, fill: true })),
    }),
    (ctx) =>
      party(ctx).map(({ hexId, className }) => ({
        hexId,
        icon: className,
        color: SKILL_COLORS.blue,
      })),
  ),
)
