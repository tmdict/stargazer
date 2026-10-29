/* The grid's order as evidence for a card's levels. Inside a group the screen lists
 * heroes from the highest paragon level down, the heroes below S+ last, and a group
 * ends on a row it leaves short. A card in doubt between cards sure of their levels
 * lies between those levels, and takes one when its own reading picks it within them.
 * Each card is placed by the cards read sure on their own, not by those this places. */

import { atLevel, LEVEL_LEAD } from '../../card/frames'
import type { CrestReading, HeroReading, RefinementReading } from '../../card/types'
import type { RosterSlot } from './types'

// A card's own reading, before its family and its crest settle its levels.
export interface CardEvidence {
  stars: RefinementReading
  // The frame match's best score at each paragon level (index = level).
  levels: readonly number[]
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

// The paragon level a card's own reading picks between lo and hi: its sure crest, or
// the frame match's best level there when it leads the others there by LEVEL_LEAD.
const pick = ({ levels, crest }: CardEvidence, lo: number, hi: number): number | null => {
  if (crest?.sure) return crest.level >= lo && crest.level <= hi ? crest.level : null
  const range = levels.map((score, level) => ({ score, level })).slice(lo, hi + 1)
  const [best, next] = range.sort((a, b) => b.score - a.score)
  return !next || best!.score - next.score >= LEVEL_LEAD ? best!.level : null
}

// A card's levels between lo and hi, when they settle them: below S+ is P0, R0 by
// rule, S+ or below with no stars is P0, R0 either way, and an S+ card takes the
// level its own reading picks.
const settle = (cell: HeroReading, seen: CardEvidence, lo: number, hi: number) => {
  const { levels, stars } = seen
  if (hi === BELOW) {
    const refinement = { ...stars, level: 0, sure: true }
    return { ...cell, paragon: atLevel(levels, 0, true), refinement }
  }
  if (lo === BELOW) {
    const bare = hi === 0 && stars.level === 0 && stars.sure
    return bare ? { ...cell, paragon: atLevel(levels, 0, true), refinement: stars } : null
  }
  const level = pick(seen, lo, hi)
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
