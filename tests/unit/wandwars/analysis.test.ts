import { describe, expect, it } from 'vitest'

import { analyzeMatches, computeTeamRecords } from '@/wandwars/prediction/analysis'
import type { MatchResult } from '@/wandwars/types'

// All smoothed rates below use META_BAYESIAN_PRIOR = 3:
// rate = (weightedWins + 3) / (weightedTotal + 6).
const m = (
  left: [string, string, string],
  right: [string, string, string],
  result: MatchResult['result'],
  weight = 1,
): MatchResult => ({ left, right, result, weight, notes: [], patch: 'test' })

describe('hero stats', () => {
  // Team abc: win (w1, left), win (w2, right side), loss (w1), draw (w1)
  const MATCHES = [
    m(['a', 'b', 'c'], ['x', 'y', 'z'], 'left'),
    m(['x', 'y', 'z'], ['c', 'a', 'b'], 'right', 2),
    m(['a', 'b', 'c'], ['x', 'y', 'z'], 'right'),
    m(['a', 'b', 'c'], ['x', 'y', 'z'], 'draw'),
  ]
  const { heroStats } = analyzeMatches(MATCHES, ['a', 'b', 'c', 'x', 'y', 'z', 'u'])

  it('tallies W/L/draw and weighted wins from both sides of the record', () => {
    expect(heroStats['a']).toMatchObject({
      matches: 4,
      wins: 2,
      losses: 1,
      draws: 1,
      weightedWins: 3, // 1 (left win) + 2 (right win, weight 2)
      weightedLosses: 1,
    })
    expect(heroStats['x']).toMatchObject({
      matches: 4,
      wins: 1,
      losses: 2,
      draws: 1,
      weightedWins: 1,
      weightedLosses: 3,
    })
  })

  it('smooths winRate over weighted W+L only — draw weight is excluded', () => {
    // a: (3 + 3) / (3 + 1 + 6) = 0.6; x mirrors to 0.4
    expect(heroStats['a']!.winRate).toBeCloseTo(0.6, 12)
    expect(heroStats['x']!.winRate).toBeCloseTo(0.4, 12)
  })

  it('gives an unseen hero the prior rate 0.5', () => {
    expect(heroStats['u']).toMatchObject({ matches: 0, winRate: 0.5 })
  })
})

describe('synergy score', () => {
  // p and q win together but each loses when apart, so the pair overperforms.
  const MATCHES = [
    m(['p', 'q', 'f1'], ['o1', 'o2', 'o3'], 'left'),
    m(['p', 'f1', 'f2'], ['o1', 'o2', 'o3'], 'right'),
    m(['q', 'f1', 'f2'], ['o1', 'o2', 'o3'], 'right'),
  ]
  const { synergyMatrix } = analyzeMatches(MATCHES, ['p', 'q', 'f1', 'f2', 'o1', 'o2', 'o3'])

  it('scores pair winrate minus average individual winrate, positive when the pair overperforms', () => {
    // p, q each 1W 1L → winRate (1+3)/(2+6) = 0.5; pair 1W → (1+3)/(1+6) = 4/7
    // score = 4/7 − 0.5 = 1/14
    expect(synergyMatrix['p']!['q']).toMatchObject({ matches: 1, wins: 1, losses: 0 })
    expect(synergyMatrix['p']!['q']!.score).toBeCloseTo(1 / 14, 12)
  })

  it('stores one shared entry under both hero orderings', () => {
    expect(synergyMatrix['q']!['p']).toBe(synergyMatrix['p']!['q'])
  })
})

describe('counter score', () => {
  // d always beats v and always loses to w, once from each side of the record.
  const MATCHES = [
    m(['d', 'f1', 'f2'], ['v', 'o1', 'o2'], 'left'),
    m(['v', 'o1', 'o2'], ['d', 'f1', 'f2'], 'right'),
    m(['d', 'f1', 'f2'], ['w', 'o1', 'o2'], 'right'),
    m(['w', 'o1', 'o2'], ['d', 'f1', 'f2'], 'left'),
  ]
  const { counterMatrix } = analyzeMatches(MATCHES, ['d', 'v', 'w', 'f1', 'f2', 'o1', 'o2'])

  it('scores vs-winrate minus overall winrate: positive counters, negative countered', () => {
    // d overall: 2W 2L → 0.5; vs v: (2+3)/(2+6) = 0.625; vs w: (0+3)/(2+6) = 0.375
    expect(counterMatrix['d']!['v']).toMatchObject({ matches: 2, wins: 2, losses: 0 })
    expect(counterMatrix['d']!['v']!.score).toBeCloseTo(0.125, 12)
    expect(counterMatrix['d']!['w']).toMatchObject({ matches: 2, wins: 0, losses: 2 })
    expect(counterMatrix['d']!['w']!.score).toBeCloseTo(-0.125, 12)
  })
})

describe('trio score', () => {
  // g+h+i win as a trio while every pair breaks even, so the trio overperforms
  // its pairwise expectation.
  const MATCHES = [
    m(['g', 'h', 'i'], ['o1', 'o2', 'o3'], 'left'),
    m(['g', 'h', 'f1'], ['o1', 'o2', 'o3'], 'right'),
    m(['g', 'i', 'f1'], ['o1', 'o2', 'o3'], 'right'),
    m(['h', 'i', 'f1'], ['o1', 'o2', 'o3'], 'right'),
  ]
  const { trioMatrix } = analyzeMatches(MATCHES, ['g', 'h', 'i', 'f1', 'o1', 'o2', 'o3'])

  it('scores trio winrate minus the mean pairwise expectation', () => {
    // Expectation per pair = avgIndividualRate + pairScore, which collapses to
    // the smoothed pair winrate. Each pair is 1W 1L → (1+3)/(2+6) = 0.5, so
    // expected = 0.5; trio is 1W → 4/7; score = 4/7 − 0.5 = 1/14.
    const trio = trioMatrix['g,h,i']!
    expect(trio).toMatchObject({ matches: 1, wins: 1, losses: 0 })
    expect(trio.winRate).toBeCloseTo(4 / 7, 12)
    expect(trio.score).toBeCloseTo(1 / 14, 12)
  })
})

describe('draw handling', () => {
  // Draws count toward match totals (data volume) but are excluded from every
  // rate denominator, matching the hero winRate convention.
  it('a drawn match does not dilute the pair winrate', () => {
    const { synergyMatrix } = analyzeMatches(
      [
        m(['p', 'q', 'f1'], ['o1', 'o2', 'o3'], 'left'),
        m(['p', 'q', 'f1'], ['o1', 'o2', 'o3'], 'draw'),
        m(['p', 'f1', 'f2'], ['o1', 'o2', 'o3'], 'right'),
        m(['q', 'f1', 'f2'], ['o1', 'o2', 'o3'], 'right'),
      ],
      ['p', 'q', 'f1', 'f2', 'o1', 'o2', 'o3'],
    )

    // p, q individually 1W 1L (draw excluded) → 0.5; pair decisive record is
    // the single win → (1+3)/(1+6) = 4/7; score = 1/14, same as without the draw
    const entry = synergyMatrix['p']!['q']!
    expect(entry.matches).toBe(2)
    expect(entry.score).toBeCloseTo(1 / 14, 12)
  })

  it('a drawn match does not make a hero look countered', () => {
    const { counterMatrix } = analyzeMatches(
      [
        m(['d', 'f1', 'f2'], ['v', 'o1', 'o2'], 'left'),
        m(['d', 'f1', 'f2'], ['v', 'o1', 'o2'], 'draw'),
      ],
      ['d', 'v', 'f1', 'f2', 'o1', 'o2'],
    )

    // d overall: 1W → 4/7; d vs v decisive: 1W → 4/7; the draw moves neither
    const entry = counterMatrix['d']!['v']!
    expect(entry.matches).toBe(2)
    expect(entry.score).toBeCloseTo(0, 12)
  })

  it('a drawn match does not dilute the trio winrate', () => {
    const { trioMatrix } = analyzeMatches(
      [
        m(['g', 'h', 'i'], ['o1', 'o2', 'o3'], 'left'),
        m(['g', 'h', 'i'], ['o1', 'o2', 'o3'], 'draw'),
      ],
      ['g', 'h', 'i', 'o1', 'o2', 'o3'],
    )

    const trio = trioMatrix['g,h,i']!
    expect(trio.matches).toBe(2)
    expect(trio.wins).toBe(1)
    expect(trio.losses).toBe(0)
    expect(trio.winRate).toBeCloseTo(4 / 7, 12)
  })
})

describe('computeTeamRecords', () => {
  const MATCHES = [
    m(['a', 'b', 'c'], ['x', 'y', 'z'], 'left'),
    m(['x', 'y', 'z'], ['c', 'a', 'b'], 'right', 2),
    m(['a', 'b', 'c'], ['x', 'y', 'z'], 'right'),
    m(['a', 'b', 'c'], ['x', 'y', 'z'], 'draw'),
  ]
  const records = computeTeamRecords(MATCHES)

  it('merges roster orderings into one sorted record per team, counting both sides', () => {
    expect(records).toHaveLength(2)
    expect(records.find((r) => r.team.join() === 'a,b,c')).toMatchObject({
      wins: 2,
      losses: 1,
      draws: 1,
      total: 4,
    })
  })

  it('smooths winRate over unweighted decisive results — draws stay in the record, not the rate', () => {
    // abc: 2W 1L → (2+3)/(3+6) = 5/9; xyz: 1W 2L → (1+3)/(3+6) = 4/9
    const abc = records.find((r) => r.team.join() === 'a,b,c')!
    const xyz = records.find((r) => r.team.join() === 'x,y,z')!
    expect(abc.winRate).toBeCloseTo(5 / 9, 12)
    expect(xyz.winRate).toBeCloseTo(4 / 9, 12)
  })
})
