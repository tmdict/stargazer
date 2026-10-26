import { describe, expect, it } from 'vitest'

import { layoutLadder } from '@/lib/pvp/ladderLayout'
import type { PvpCounter, PvpSeasonSummary, PvpTeam } from '@/lib/types/pvp'

// A four-team season small enough to work the rules out by hand: a beats b
// and c below it (right side, sharing a's edge), d beats a from the bottom
// (left side, three rows up).
const team = (id: string, rating: number, tier: number): PvpTeam => ({
  id,
  name: { en: id, zh: id },
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
  languages: ['en', 'zh'],
  teams: [team('c', 2, 2), team('a', 4, 1), team('d', 1, 2), team('b', 3, 1)],
  counters: [counter('a', 'b'), counter('a', 'c'), counter('d', 'a')],
}
const share = (c: PvpCounter): string =>
  `${Math.round((100 * c.wins) / (c.wins + c.losses))}% of ${c.wins + c.losses}`

// A label's box as the layout estimates it, back in viewBox units.
const LABEL_H = 32
const box = (layout: ReturnType<typeof layoutLadder>, anchor: string) => {
  const { label } = layout.edges.find((e) => e.counter.anchor === anchor)!
  const w = label.text.length * 13 + 20
  const x = (label.left / 100) * layout.width
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
    expect(layout.rows.map((row) => row.top)).toEqual([12.5, 37.5, 62.5, 87.5])
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
})
