/* The grid's order as evidence for a card's levels. Inside a group the screen lists
 * heroes from the highest paragon level down, the heroes below S+ last, and a group
 * ends on a row it leaves short. A card in doubt between cards sure of their levels
 * lies between those levels, and takes one when only one is left or when its frame
 * match and crest settle it within them (levelBetween). Each card is placed by the
 * cards read sure on their own, not by those this places. A group that fills its last
 * row runs on into the next unseen, so a card in doubt beside that break can take the
 * other group's levels. */

import { atLevel, levelBetween } from '../../card/frames'
import type { CrestReading, HeroReading, RefinementReading } from '../../card/types'
import type { RosterSlot } from './types'

// A card's own reading, before its family and its crest settle its levels.
export interface CardEvidence {
  stars: RefinementReading
  // The frame match's best score at each paragon level (index = level).
  levels: readonly number[]
  // Null where the crest does not show, as on a card the header covers.
  crest: CrestReading | null
}

// Below S+, under every paragon level.
const BELOW = -1

type Bounds = readonly [lo: number, hi: number]

// The levels a card sure of them can be. One whose family is in doubt is sure only
// of P0, R0, which both families give: it is S+ or below.
const boundsOf = ({ frame, cell }: RosterSlot): Bounds | null => {
  if (!frame || !cell?.paragon.sure) return null
  if (!frame.sure) return [BELOW, 0]
  return frame.family === 'below' ? [BELOW, BELOW] : [cell.paragon.level, cell.paragon.level]
}

// The grid's read cards by group, in reading order.
const groupsOf = (slots: readonly RosterSlot[]): number[][] => {
  const groups: number[][] = []
  let row: number | null = null
  let short = true
  slots.forEach((slot, i) => {
    if (slot.hands) return
    if (slot.row !== row) {
      if (short) groups.push([])
      short = false
      row = slot.row
    }
    if (slot.kind === 'empty') short = true
    if (slot.cell) groups.at(-1)!.push(i)
  })
  return groups
}

// A sure card above one before it means a group break went unseen or a level was
// misread, so its group gets no help from the order.
const ordered = (bounds: readonly (Bounds | null)[]): boolean => {
  let hi = Infinity
  for (const b of bounds) {
    if (!b) continue
    if (b[0] > hi) return false
    hi = Math.min(hi, b[1])
  }
  return true
}

// A card's levels between lo and hi, when they settle them: below S+ is P0, R0 by
// rule, S+ or below with no stars is P0, R0 either way, and an S+ card takes the one
// level left or the one its frame match and crest settle there.
const settle = (cell: HeroReading, seen: CardEvidence, lo: number, hi: number) => {
  const { levels, stars, crest } = seen
  if (hi === BELOW) {
    const refinement = { ...stars, level: 0, sure: true }
    return { ...cell, paragon: atLevel(levels, 0, true), refinement }
  }
  if (lo === BELOW) {
    const bare = hi === 0 && stars.level === 0 && stars.sure
    return bare ? { ...cell, paragon: atLevel(levels, 0, true), refinement: stars } : null
  }
  // Without the crest the frame match cannot tell P0 from P2, so the card takes a
  // level only when one is left.
  const level = crest ? levelBetween(levels, crest, lo, hi) : lo === hi ? lo : null
  return level === null
    ? null
    : { ...cell, paragon: atLevel(levels, level, true), refinement: stars }
}

/* The slots with the levels the grid's order settles for cards in doubt. */
export function settleByOrder(
  slots: readonly RosterSlot[],
  evidence: ReadonlyMap<number, CardEvidence>,
): RosterSlot[] {
  const out = [...slots]
  for (const group of groupsOf(slots)) {
    const bounds = group.map((i) => boundsOf(slots[i]!))
    if (!ordered(bounds)) continue
    group.forEach((i, k) => {
      const { frame, cell } = slots[i]!
      const seen = evidence.get(i)
      if (!frame || !cell || !seen || cell.paragon.sure) return
      const top = seen.levels.length - 1
      // A card sure of its family is S+, since one sure below S+ is sure of its levels.
      const floor = frame.sure ? 0 : BELOW
      const lo = Math.max(floor, ...bounds.slice(k + 1).map((b) => b?.[0] ?? BELOW))
      const hi = Math.min(top, ...bounds.slice(0, k).map((b) => b?.[1] ?? top))
      const settled = lo <= hi ? settle(cell, seen, lo, hi) : null
      if (settled) out[i] = { ...slots[i]!, cell: settled }
    })
  }
  return out
}
