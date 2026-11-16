import { describe, expect, it } from 'vitest'

import { solveMaxChance } from '@/lib/hd/shop/maxChance'
import { firstMoves } from '@/lib/hd/shop/moves'
import { checkOdds } from '@/lib/hd/shop/odds'
import { OutOfTime } from '@/lib/hd/shop/search'
import type { Goal, LevelOdds, Move, OddsTable, PoolHero, ShopCard } from '@/lib/hd/shop/types'
import {
  card,
  cards,
  chance,
  FACTS,
  hero,
  HEROES,
  levelOdds,
  ODDS,
  pools,
  REROLL,
  type Asked,
} from '../../fixtures/hdShop'

const buy = (at: number): Move => ({ kind: 'buy', card: at })
const lock = (...locks: number[]): Move => ({ kind: 'reroll', locks })
const others = HEROES.map((h) => h.name).filter((name) => name !== 'L1')

// The shop doc's check cases, to four decimals of a percent.
describe('the check cases', () => {
  it('E1: an empty shop at level 5', () => {
    expect(chance({ level: 5, badges: 60, goal: hero('L1') })).toBeCloseTo(0.866792, 5)
  })

  it('E2: locking a wanted card beats a plain reroll when two copies are needed', () => {
    const asked = {
      level: 5,
      badges: 60,
      goal: hero('L1', 2),
      cards: cards(card('hero', { hero: 'L1' })),
    }
    expect(chance(asked, lock(0))).toBeCloseTo(0.712273, 5)
    expect(chance(asked)).toBeCloseTo(0.560881, 5)
  })

  it('E3: a wanted card on show that the badges can buy is certain', () => {
    const asked = {
      level: 4,
      badges: 45,
      goal: hero('L1'),
      cards: cards(card('hero-pair', { hero: 'L1' })),
    }
    expect(chance(asked, buy(0))).toBe(1)
    expect(chance(asked)).toBeCloseTo(0.730095, 5)
  })

  it('E4: packs on show, one hero at a time and any of three', () => {
    const shop = cards(
      card('random-pack'),
      card('lightbearer-pack'),
      card('wilder-pack'),
      card('rare-equipment'),
      card('artifact-exp'),
      card('artifact-exp'),
      card('random-pack'),
      card('rare-equipment'),
    )
    const asked = (goal: Goal) => ({ level: 1, badges: 54, goal, cards: shop })
    expect(chance(asked(hero('L1')), buy(1))).toBeCloseTo(0.390941, 5)
    expect(chance(asked(hero('L1')))).toBeCloseTo(0.352443, 5)
    expect(chance(asked(hero('M1')))).toBeCloseTo(0.352443, 5)
    expect(chance(asked(hero('W1')), buy(2))).toBeCloseTo(0.390941, 5)
    const any = { heroes: ['L1', 'M1', 'W1'], equipment: [], copies: 1 }
    expect(chance(asked(any), buy(0))).toBeCloseTo(0.501382, 5)
    expect(chance(asked(any), buy(6))).toBeCloseTo(0.501382, 5)
    expect(chance(asked(any))).toBeCloseTo(0.497922, 5)
  })

  it('E5: badges back from sold heroes pay for more rerolls', () => {
    const asked = {
      level: 3,
      badges: 40,
      goal: hero('L1'),
      sell: others,
      cards: cards(card('lightbearer-pack'), card('random-pack')),
    }
    expect(chance(asked)).toBeCloseTo(0.636878, 5)
  })

  it('E6: one Epic piece of equipment', () => {
    const goal: Goal = { heroes: [], equipment: [{ name: 'blade', tier: 'epic' }], copies: 1 }
    expect(chance({ level: 4, badges: 60, goal })).toBeCloseTo(0.145363, 5)
  })
})

describe('a table where one source always makes a pack', () => {
  const odds: LevelOdds = [
    [{ good: 'random-pack', percent: 100 }],
    ...Array.from({ length: 7 }, () => [{ good: 'artifact-exp', percent: 100 }]),
  ]
  const shop = [card('random-pack'), ...Array.from({ length: 7 }, () => card('artifact-exp'))]
  const two = HEROES.slice(0, 2)
  const solve = (badges: number) =>
    solveMaxChance({ badges, cards: shop }, hero('L1', 2), odds, pools([], two), FACTS)!

  it('gives one pack to 18 badges and to 36, and a second pack to 39', () => {
    expect(solve(18).chance(buy(0))).toBeCloseTo(1 / 2, 9)
    expect(solve(36).chance(buy(0))).toBeCloseTo(1 / 2, 9)
    expect(solve(39).chance(buy(0))).toBeCloseTo(57 / 64, 9)
  })

  it('treats a source with nothing listed as one that never helps', () => {
    const empty: LevelOdds = [odds[0]!, ...Array.from({ length: 7 }, () => [])]
    const table: OddsTable = { levels: Array.from({ length: 5 }, () => empty) }
    expect(checkOdds(table, FACTS)).toBe(table)
    const cardsShown = [card('random-pack'), ...Array.from({ length: 7 }, () => card())]
    const solved = solveMaxChance(
      { badges: 39, cards: cardsShown },
      hero('L1', 2),
      empty,
      pools([], two),
      FACTS,
    )!
    expect(solved.chance(buy(0))).toBeCloseTo(57 / 64, 9)
    // The pack can only have come from the one source that makes it.
    const blocked = [card(), card('random-pack'), card('random-pack')]
    expect(
      solveMaxChance({ badges: 39, cards: blocked }, hero('L1'), empty, pools(), FACTS),
    ).toBeNull()
  })
})

// A counter that follows every outcome and shares nothing with the calculator.
// It is only right where a card's product tells which source made it, give or
// take sources with the same odds, so that nothing is hidden from the player.
function slowCounter(odds: LevelOdds, pool: PoolHero[], wanted: string, sell: string[]) {
  const goods = new Map(FACTS.goods.map((good) => [good.name, good]))
  const known = new Map<string, number>()

  const packResults = (name: string) => {
    const good = goods.get(name)!
    const from = good.faction ? pool.filter((h) => h.faction === good.faction) : pool
    let results = [{ gain: 0, refund: 0, chance: 1 }]
    for (let pick = 0; pick < (good.draws ?? 1); pick++) {
      results = results.flatMap((result) =>
        from.map((picked) => ({
          gain: result.gain + (picked.name === wanted ? (good.copies ?? 1) : 0),
          refund:
            result.refund +
            (picked.name !== wanted && sell.includes(picked.name)
              ? FACTS.sell * (good.copies ?? 1)
              : 0),
          chance: result.chance / from.length,
        })),
      )
    }
    return results
  }

  // What a source can show: a wanted hero's card, a pack, or nothing of use.
  const faces = odds.map((entries) => {
    const face = new Map<string, number>()
    const add = (name: string, share: number) => face.set(name, (face.get(name) ?? 0) + share)
    for (const entry of entries) {
      const good = goods.get(entry.good)!
      const share = entry.percent / 100
      if (good.kind === 'hero') {
        add(entry.good, share / pool.length)
        add('', share * (1 - 1 / pool.length))
      } else if (good.kind === 'pack') add(entry.good, share)
      else add('', share)
    }
    return [...face]
  })

  const count = (need: number, badges: number, shown: string[]): number => {
    if (need <= 0) return 1
    const key = `${need}|${badges}|${shown.join(',')}`
    const answer = known.get(key)
    if (answer !== undefined) return answer
    let best = 0
    shown.forEach((name, at) => {
      const good = goods.get(name)
      if (!good || good.price > badges) return
      const rest = shown.map((other, i) => (i === at ? '' : other))
      const left = badges - good.price
      const value =
        good.kind === 'hero'
          ? count(need - (good.copies ?? 1), left, rest)
          : packResults(name).reduce(
              (sum, r) => sum + r.chance * count(need - r.gain, left + r.refund, rest),
              0,
            )
      best = Math.max(best, value)
    })
    if (badges >= FACTS.reroll) {
      for (let mask = 0; mask < 1 << shown.length; mask++) {
        if (shown.some((name, i) => (mask >> i) & 1 && !name)) continue
        let shops: [string[], number][] = [[[], 1]]
        shown.forEach((name, i) => {
          shops = shops.flatMap(([list, p]): [string[], number][] =>
            (mask >> i) & 1
              ? [[[...list, name], p]]
              : faces[i]!.map(([face, share]) => [[...list, face], p * share]),
          )
        })
        const value = shops.reduce(
          (sum, [list, p]) => sum + p * count(need, badges - FACTS.reroll, list),
          0,
        )
        best = Math.max(best, value)
      }
    }
    known.set(key, best)
    return best
  }

  /** The chance after a first move from `shown`, one entry per source. */
  return (need: number, badges: number, shown: string[], move: Move): number => {
    if (move.kind === 'buy') {
      const good = goods.get(shown[move.card]!)!
      const rest = shown.map((other, i) => (i === move.card ? '' : other))
      const left = badges - good.price
      return good.kind === 'hero'
        ? count(need - (good.copies ?? 1), left, rest)
        : packResults(good.name).reduce(
            (sum, r) => sum + r.chance * count(need - r.gain, left + r.refund, rest),
            0,
          )
    }
    let shops: [string[], number][] = [[[], 1]]
    shown.forEach((name, i) => {
      shops = shops.flatMap(([list, p]): [string[], number][] =>
        move.locks.includes(i)
          ? [[[...list, name], p]]
          : faces[i]!.map(([face, share]) => [[...list, face], p * share]),
      )
    })
    return shops.reduce((sum, [list, p]) => sum + p * count(need, badges - FACTS.reroll, list), 0)
  }
}

describe('against a counter that follows every outcome', () => {
  const three = HEROES.slice(0, 3)
  const widestGap = (
    odds: LevelOdds,
    sell: string[],
    need: number,
    badges: number,
    shown: string[],
    moves: Move[],
  ) => {
    const counter = slowCounter(odds, three, 'L1', sell)
    const shop: ShopCard[] = shown.map((name) =>
      name ? card(name, name.startsWith('hero') ? { hero: 'L1' } : {}) : card(),
    )
    const solved = solveMaxChance(
      { badges, cards: shop },
      hero('L1', need),
      odds,
      pools(sell, three),
      FACTS,
    )!
    return Math.max(
      ...moves.map((move) => Math.abs(solved.chance(move) - counter(need, badges, shown, move))),
    )
  }
  // The search stops within one part in a million of the answer.
  const CLOSE = 2e-6

  it('agrees when every source has the same odds', () => {
    const odds: LevelOdds = Array.from({ length: 4 }, () => [
      { good: 'hero', percent: 30 },
      { good: 'random-pack', percent: 20 },
      { good: 'artifact-exp', percent: 50 },
    ])
    expect(widestGap(odds, [], 2, 40, ['', '', '', ''], [REROLL])).toBeLessThan(CLOSE)
    expect(
      widestGap(
        odds,
        ['L2'],
        2,
        42,
        ['hero', 'random-pack', '', ''],
        [buy(0), buy(1), REROLL, lock(0), lock(1), lock(0, 1)],
      ),
    ).toBeLessThan(CLOSE)
  })

  it('agrees when hero cards and packs come from different sources', () => {
    const cardSource = [
      { good: 'hero', percent: 40 },
      { good: 'hero-pair', percent: 10 },
      { good: 'artifact-exp', percent: 50 },
    ]
    const packSource = [
      { good: 'random-pack', percent: 50 },
      { good: 'artifact-exp', percent: 50 },
    ]
    const odds: LevelOdds = [cardSource, cardSource, packSource, packSource]
    expect(widestGap(odds, ['L3'], 3, 45, ['', '', '', ''], [REROLL])).toBeLessThan(CLOSE)
    expect(
      widestGap(
        odds,
        ['L3'],
        3,
        48,
        ['hero', '', 'random-pack', 'random-pack'],
        [buy(0), buy(2), REROLL, lock(0), lock(2, 3), lock(0, 2)],
      ),
    ).toBeLessThan(CLOSE)
  })
})

describe('rules that always hold', () => {
  const shop = cards(
    card('hero', { hero: 'L1', locked: true }),
    card('random-pack'),
    card('lightbearer-pack'),
    card('elite-equipment', { equipment: 'ring' }),
    card('hero', { hero: 'M2' }),
  )
  const asked = (more: Partial<Asked> = {}): Asked => ({
    level: 3,
    badges: 48,
    goal: hero('L1', 2),
    cards: shop,
    ...more,
  })
  // The search stops within one part in a million of the answer.
  const SLACK = 2e-6

  it('more badges never lower a chance, and more copies never raise it', () => {
    const byBadges = [30, 33, 36, 41, 48, 60].map((badges) => chance(asked({ badges })))
    byBadges
      .slice(1)
      .forEach((value, i) => expect(value).toBeGreaterThanOrEqual(byBadges[i]! - SLACK))
    const byCopies = [1, 2, 3, 4].map((copies) => chance(asked({ goal: hero('L1', copies) })))
    byCopies.slice(1).forEach((value, i) => expect(value).toBeLessThanOrEqual(byCopies[i]! + SLACK))
  })

  it('the order of the eight cards changes nothing', () => {
    const turned = [...shop].reverse()
    for (const move of [REROLL, lock(0), lock(0, 1), buy(0), buy(2)]) {
      const mirrored: Move =
        move.kind === 'buy'
          ? buy(7 - move.card)
          : lock(...move.locks.map((at) => 7 - at).sort((a, b) => a - b))
      expect(chance(asked({ cards: turned }), mirrored)).toBeCloseTo(chance(asked(), move), 5)
    }
  })

  it('every first move has its answer between its floor and its ceiling', () => {
    const solved = solveMaxChance(
      { badges: 48, cards: shop },
      hero('L1', 2),
      levelOdds(3),
      pools(),
      FACTS,
    )!
    const wanted = { heroes: new Set(['L1']), equipment: new Set<string>() }
    const moves = firstMoves({ badges: 48, cards: shop }, wanted, FACTS)
    expect(moves.length).toBeGreaterThan(8)
    for (const move of moves) {
      const { floor, ceiling } = solved.range(move)
      const answer = solved.chance(move)
      expect(answer).toBeGreaterThanOrEqual(floor - 1e-9)
      expect(answer).toBeLessThanOrEqual(ceiling + 1e-9)
    }
  })
})

describe('heavier requests', () => {
  // HD Lab gives 64.5977% and 88.0006% here: it always keeps a wanted card
  // through a reroll, which is not always the best move.
  it('three and four copies', () => {
    expect(chance({ level: 5, badges: 100, goal: hero('L1', 3) })).toBeCloseTo(0.646006, 5)
    expect(chance({ level: 4, badges: 200, goal: hero('L1', 4), sell: others })).toBeCloseTo(
      0.880013,
      5,
    )
  })

  it('stops at its deadline and still has the range', () => {
    const solved = solveMaxChance(
      { badges: 150, cards: cards() },
      hero('L1', 4),
      ODDS.levels[4]!,
      pools(),
      FACTS,
    )!
    solved.search.stats.deadline = 0
    expect(() => solved.chance(REROLL)).toThrow(OutOfTime)
    const { floor, ceiling } = solved.range(REROLL)
    expect(floor).toBeLessThan(ceiling)
    expect(ceiling - floor).toBeLessThan(0.01)
  })
})
