import { registerSkill } from '../registry'
import type { SkillContext, SkillTargetInfo } from '../skill'
import { createTargetingSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { rowScanOrder, ScanDirection } from '../utils/ring'

const SEEDS = 2

// When a battle starts, the awakening plants Drain Seeds in the 2 teammates
// nearest Saida. Between teammates as near, the frontmost row goes first, but
// within a row the tile on her right as she faces the other team (the lower hex
// id for an ally). Unlike Galahad's pick, every unit counts: battles show the
// phantimal and Lailah receiving seeds.
function calculateTarget(ctx: SkillContext): SkillTargetInfo | null {
  const order = rowScanOrder(ctx, {
    team: ctx.team,
    rowDirection: ScanDirection.FRONTMOST,
    withinRowDirection: ScanDirection.REARMOST,
  })
  if (order.length === 0) return null

  return {
    targetHexId: null,
    targetCharacterId: null,
    metadata: {
      arrows: order.slice(0, SEEDS).map((unit) => ({
        fromHexId: ctx.hexId,
        toHexId: unit.hexId,
        type: 'ally' as const,
      })),
      examinedTiles: order.map((unit) => unit.hexId),
      isRowScanTarget: true,
    },
  }
}

registerSkill(
  createTargetingSkill({
    id: 'saida',
    characterId: 87,
    color: SKILL_COLORS.purple,
    calculateTarget,
  }),
)
