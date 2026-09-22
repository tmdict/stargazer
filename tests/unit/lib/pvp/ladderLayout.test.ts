import { describe, expect, it } from 'vitest'

import { LADDER_ROW, layoutLadder } from '@/lib/pvp/ladderLayout'
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
const counter = (winner: string, loser: string): PvpCounter => ({
  winner,
  loser,
  wins: 1,
  losses: 0,
  band: 3,
  anchor: `${winner}-${loser}`,
})
const summary: PvpSeasonSummary = {
  season: 0,
  teams: [team('c', 2, 2), team('a', 4, 1), team('d', 1, 2), team('b', 3, 1)],
  counters: [counter('a', 'b'), counter('a', 'c'), counter('d', 'a')],
}

describe('layoutLadder', () => {
  const layout = layoutLadder(summary)
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

  it('centres the drawing on its outermost labels, not the node column', () => {
    // Outer points: 505 and 523 on the right, 99 on the left; with the
    // 22-unit label half-width the extremes are 77 and 545, centred at 311.
    expect(layout.offset).toBeCloseTo(((320 - 311) / 640) * 100, 2)
  })

  it('pushes record labels apart when curves on one side share a midpoint', () => {
    // a beats d (rows 0 to 3) and b beats c (rows 1 to 2): both right-side
    // curves centred on the same y, their outer points 36 units apart.
    const stacked: PvpSeasonSummary = {
      ...summary,
      counters: [counter('a', 'd'), counter('b', 'c')],
    }
    const [outer, inner] = layoutLadder(stacked).edges.map((e) => e.label.top)
    expect(inner! - outer!).toBeCloseTo((18 / (LADDER_ROW * 4)) * 100, 1)
  })
})
