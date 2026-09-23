import { describe, expect, it } from 'vitest'

import { FEW_GAMES, LADDER_ROW, LADDER_WIDTH, layoutLadder } from '@/lib/pvp/ladderLayout'
import type { PvpCounter, PvpSeasonSummary, PvpTeam } from '@/lib/types/pvp'

// A four-team season small enough to work the rules out by hand: a beats b
// and c below it (right side, sharing a's edge), d beats a from the bottom
// (left side, three rows up).
const team = (id: string, rating: number, tier: number): PvpTeam => ({
  id,
  name: id,
  heroes: [],
  games: 1,
  rating,
  tier,
})
const counter = (winner: string, loser: string, wins = 1, losses = 0): PvpCounter => ({
  winner,
  loser,
  wins,
  losses,
  band: 3,
  anchor: `${winner}-${loser}`,
})
const summary: PvpSeasonSummary = {
  season: 0,
  teams: [team('c', 2, 2), team('a', 4, 1), team('d', 1, 2), team('b', 3, 1)],
  counters: [counter('a', 'b'), counter('a', 'c'), counter('d', 'a')],
}
const share = (c: PvpCounter): string =>
  `${Math.round((100 * c.wins) / (c.wins + c.losses))}% of ${c.wins + c.losses}`

// A label's box as the layout estimates it, back in viewBox units.
const LABEL_H = 16
const box = (layout: ReturnType<typeof layoutLadder>, anchor: string) => {
  const { label } = layout.edges.find((e) => e.counter.anchor === anchor)!
  const w = label.text.length * 7 + 12
  const x = (label.left / 100) * LADDER_WIDTH
  const y = (label.top / 100) * layout.height
  return { x0: x - w / 2, x1: x + w / 2, y0: y - LABEL_H / 2, y1: y + LABEL_H / 2 }
}
type Box = ReturnType<typeof box>
const apart = (a: Box, b: Box): boolean =>
  a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0

describe('layoutLadder', () => {
  const layout = layoutLadder(summary, share)
  const edge = (anchor: string) => layout.edges.find((e) => e.counter.anchor === anchor)!

  it('stacks rows by rating, rules the tier change, and curves each counter by the rules', () => {
    expect(layout.rows.map((row) => row.team.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(layout.height).toBe(LADDER_ROW * 4)
    expect(layout.tiers).toEqual([
      { tier: 1, top: 0 },
      { tier: 2, top: 50 },
    ])

    // Winner above: right side, bowing 36 + 24 per row spanned; the two
    // curves leaving a's edge fan 12 apart in the order of their far rows.
    expect(edge('a-b').side).toBe('right')
    expect(edge('a-b').path).toBe('M460,38 C520,38 520,132 460,132')
    expect(edge('a-c').path).toBe('M460,50 C544,50 544,220 460,220')
    // Winner below: left side, arrowhead at the loser's left edge.
    expect(edge('d-a').side).toBe('left')
    expect(edge('d-a').path).toBe('M180,308 C72,308 72,44 180,44')
    expect(edge('d-a').arrow).toEqual({ left: 28.13, top: 12.5 })
  })

  it("sits an unobstructed label at its curve's widest point and centres on the label's box", () => {
    const single = layoutLadder({ ...summary, counters: [counter('a', 'b')] }, share)
    // The curve from row 0 to row 1 bows 60, so its widest point is x 505,
    // y 88: nothing else to cover, so the label sits right there.
    expect(single.edges[0]!.label).toEqual({ text: '100% of 1', left: 78.91, top: 25 })
    // "100% of 1" is 9 characters, a 75-unit box reaching x 542.5; the
    // extremes 180 and 542.5 centre at 361.25 against the 320 midpoint.
    expect(single.offset).toBeCloseTo(((320 - 361.25) / LADDER_WIDTH) * 100, 2)
  })

  it('keeps labels off each other, the other curves and the cards', () => {
    // a beats d (rows 0 to 3) and b beats c (rows 1 to 2): both right-side
    // curves share a midpoint, and the outer curve runs through the inner
    // label's natural spot.
    const stacked = layoutLadder(
      { ...summary, counters: [counter('a', 'd'), counter('b', 'c')] },
      share,
    )
    const outer = box(stacked, 'a-d')
    const inner = box(stacked, 'b-c')
    expect(apart(outer, inner)).toBe(true)
    const cards = stacked.rows.map((row) => {
      const y = (row.top / 100) * stacked.height
      return { x0: 180, x1: 460, y0: y - 29, y1: y + 29 }
    })
    for (const card of cards) {
      expect(apart(outer, card)).toBe(true)
      expect(apart(inner, card)).toBe(true)
    }
  })

  it('dims a share drawn from fewer than eight games', () => {
    const mixed = layoutLadder(
      { ...summary, counters: [counter('a', 'b', 5, 2), counter('a', 'c', 5, 3)] },
      share,
    )
    expect(mixed.edges.map((e) => [e.counter.wins + e.counter.losses, e.few])).toEqual([
      [FEW_GAMES - 1, true],
      [FEW_GAMES, false],
    ])
  })
})
