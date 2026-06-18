import { findCharacterHex } from '../../characters/character'
import { getCompanions } from '../../characters/companion'
import type { Hex } from '../../hex'
import { registerSkill } from '../registry'
import type { SkillContext, SkillLine, TilePaint } from '../skill'
import { createCompanionSkill, withSkillLine, withTilePaint } from '../utils/builders'
import { hexesBetween } from '../utils/line'

const SKILL_COLOR = '#51abcb'
const COMPANION_COLOR = '#cd7169'

// Shared state for both visuals; null unless the twins are collinear with a gap.
function twinState(ctx: SkillContext): {
  companionHexId: number
  between: Hex[]
  allies: Array<{ hexId: number; characterId: number }>
  color: string
} | null {
  const { grid, hexId, team, characterId, factionOf } = ctx
  const companionIds = [...getCompanions(grid, characterId, team)]
  if (companionIds.length === 0) return null
  const companionHexId = findCharacterHex(grid, companionIds[0]!, team)
  if (companionHexId === null) return null

  const between = hexesBetween(grid.getHexById(hexId), grid.getHexById(companionHexId))
  if (between.length === 0) return null

  const allies: Array<{ hexId: number; characterId: number }> = []
  for (const hex of between) {
    const tile = grid.getTileOrUndefined(hex)
    if (tile?.characterId !== undefined && tile.team === team) {
      allies.push({ hexId: tile.hex.getId(), characterId: tile.characterId })
    }
  }

  // One color for the borders and the line: companion color when the sandwiched
  // allies all share a faction (a lone ally counts), else skill color (also the
  // fallback when none are between).
  const factions = new Set(allies.map((ally) => factionOf?.(ally.characterId)))
  const color = factions.size === 1 ? COMPANION_COLOR : SKILL_COLOR

  return { companionHexId, between, allies, color }
}

function calculateBetweenTiles(ctx: SkillContext): TilePaint[] {
  const state = twinState(ctx)
  if (!state) return []
  return state.allies.map((ally) => ({ hexId: ally.hexId, color: state.color }))
}

function calculateLine(ctx: SkillContext): SkillLine[] {
  const state = twinState(ctx)
  if (!state) return []
  const { grid } = ctx

  // Anchors along the axis: the twins plus any characters between them, in order.
  // A border-to-border segment between each consecutive pair breaks the line around
  // every character icon while keeping it visible everywhere else — including the
  // small gap between adjacent icons (the icons don't touch).
  const anchors = [ctx.hexId]
  for (const hex of state.between) {
    const tile = grid.getTileOrUndefined(hex)
    if (tile?.characterId !== undefined) anchors.push(tile.hex.getId())
  }
  anchors.push(state.companionHexId)

  const lines: SkillLine[] = []
  for (let i = 0; i < anchors.length - 1; i++) {
    lines.push({ fromHexId: anchors[i]!, toHexId: anchors[i + 1]!, color: state.color })
  }
  return lines
}

// Elijah and Lailah occupy separate tiles, increasing team capacity by 1.
// Removing either removes both. Lailah has a range of 1.
registerSkill(
  withTilePaint(
    withSkillLine(
      createCompanionSkill({
        id: 'elijah-lailah',
        characterId: 68,
        colorModifier: SKILL_COLOR,
        companionColorModifier: COMPANION_COLOR,
        companionRange: 1,
      }),
      calculateLine,
    ),
    calculateBetweenTiles,
  ),
)
