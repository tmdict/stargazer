import { describe, expect, it } from 'vitest'

import { solveMaxChance } from '@/lib/hd/shop/maxChance'
import { solveMinBadges } from '@/lib/hd/shop/minBadges'
import { firstMoves } from '@/lib/hd/shop/moves'
import { solveNextRound, stopReason } from '@/lib/hd/shop/nextRound'
import { createSolverCache } from '@/lib/hd/shop/solverCache'
import type { Goal, LevelOdds, Move, Pools, ShopCard } from '@/lib/hd/shop/types'
import { card, cards, FACTS, hero, HEROES, levelOdds, pools, REROLL } from '../../fixtures/hdShop'

const buy = (at: number): Move => ({ kind: 'buy', card: at })
const lock = (...locks: number[]): Move => ({ kind: 'reroll', locks })
const others = HEROES.map((h) => h.name).filter((name) => name !== 'L1')

interface Asked {
  odds: LevelOdds
  goal: Goal
  badges?: number
  cards?: ShopCard[]
  pools?: Pools
  /** The next level's odds, when the shop level rises next round. */
  next?: LevelOdds
}

/** Both answers for one goal, with the first moves the page would compare. */
function solve(asked: Asked) {
  const shop = { badges: asked.badges ?? 60, cards: asked.cards ?? cards() }
  const wanted = {
    heroes: new Set(asked.goal.heroes),
    equipment: new Set(asked.goal.equipment.map((piece) => piece.name)),
  }
  const moves = firstMoves({ ...shop, badges: Infinity }, wanted, FACTS)
  const pool = asked.pools ?? pools()
  const min = solveMinBadges(shop, asked.goal, asked.odds, pool, FACTS)!
  const stop = solveNextRound(shop, asked.goal, asked.odds, asked.next ?? null, pool, FACTS)!
  const best = min.best(moves)
  const plan = stop.best(moves)
  return {
    min,
    stop,
    moves,
    best,
    plan,
    get reason() {
      const chance = solveMaxChance(shop, asked.goal, asked.odds, pool, FACTS)!
      const wait = asked.next ? plan : null
      return best && stopReason(best, shop, FACTS, (move) => chance.chance(move), wait)
    },
  }
}

const at = (level: number, goal: Goal, more: Partial<Asked> = {}): Asked => ({
  odds: levelOdds(level),
  goal,
  ...more,
})

const packShop = cards(
  card('random-pack'),
  card('lightbearer-pack'),
  card('wilder-pack'),
  card('rare-equipment'),
  card('artifact-exp'),
  card('artifact-exp'),
  card('random-pack'),
  card('rare-equipment'),
)

// The shop doc's check cases. Its E2 figure, 55.67, is from Toto's calculator, which rounds
// the chances of which source a locked card holds; unrounded it is 55.61.
describe('the check cases', () => {
  it('E1: an empty shop at level 5', () => {
    const { best, reason } = solve(at(5, hero('L1')))
    expect(best!.move).toEqual(REROLL)
    expect(best!.cost.ceiling).toBeCloseTo(41.6688, 3)
    expect(reason).toBeNull()
  })

  it('E2: with two copies needed, the card on show is locked through the reroll', () => {
    const { best, min } = solve(
      at(5, hero('L1', 2), { cards: cards(card('hero', { hero: 'L1' })) }),
    )
    expect(best!.move).toEqual(lock(0))
    expect(best!.cost.ceiling).toBeCloseTo(55.6142, 3)
    expect(min.cost(buy(0)).ceiling).toBeCloseTo(56.6688, 3)
  })

  it('E3: a card that finishes the goal is bought', () => {
    const shop = cards(card('hero-pair', { hero: 'L1' }))
    const { best, reason } = solve(at(4, hero('L1'), { badges: 45, cards: shop }))
    expect(best).toEqual({ move: buy(0), cost: { floor: 30, ceiling: 30 } })
    expect(reason).toBeNull()
  })

  it('E4: packs on show, one hero at a time and any of three', () => {
    const one = (name: string) => solve(at(1, hero(name), { badges: 54, cards: packShop })).best!
    expect(one('L1').move).toEqual(buy(1))
    expect(one('L1').cost.ceiling).toBeCloseTo(112.6779, 3)
    expect(one('M1').move).toEqual(REROLL)
    expect(one('M1').cost.ceiling).toBeCloseTo(118.9361, 3)
    expect(one('W1').move).toEqual(buy(2))
    expect(one('W1').cost.ceiling).toBeCloseTo(112.6779, 3)
    const any = { heroes: ['L1', 'M1', 'W1'], equipment: [], copies: 1 }
    const { best, min } = solve(at(1, any, { badges: 54, cards: packShop }))
    expect(best!.move).toEqual(buy(0))
    expect(best!.cost.ceiling).toBeCloseTo(74.5262, 3)
    expect(min.cost(buy(6))).toEqual(best!.cost)
  })

  it('E5: badges back from sold heroes lower the cost', () => {
    const shop = cards(card('lightbearer-pack'), card('random-pack'))
    const { best } = solve(at(3, hero('L1'), { badges: 40, cards: shop, pools: pools(others) }))
    expect(best!.move).toEqual(REROLL)
    expect(best!.cost.ceiling).toBeCloseTo(40.2233, 3)
  })

  it('E6: one Epic piece, which is 3 ÷ the chance a reroll shows it + its price', () => {
    const goal: Goal = { heroes: [], equipment: [{ name: 'blade', tier: 'epic' }], copies: 1 }
    const { best } = solve(at(4, goal))
    const miss = levelOdds(4).reduce((none, source) => {
      const epic = source.find((entry) => entry.good === 'epic-equipment')?.percent ?? 0
      return none * (1 - epic / 100 / 20)
    }, 1)
    expect(best!.move).toEqual(REROLL)
    expect(best!.cost.ceiling).toBeCloseTo(3 / (1 - miss) + 40, 6)
    expect(best!.cost.ceiling).toBeCloseTo(156.0991, 3)
  })

  it('E7: a shop that cannot happen has no answer', () => {
    const shop = { badges: 60, cards: cards(...Array(8).fill(card('epic-equipment'))) }
    expect(solveMinBadges(shop, hero('L1'), levelOdds(1), pools(), FACTS)).toBeNull()
    expect(solveNextRound(shop, hero('L1'), levelOdds(1), null, pools(), FACTS)).toBeNull()
  })

  it('E8: stops when the badges cannot finish this round, and costs the wait at level 3', () => {
    const { best, reason, plan } = solve(at(2, hero('L1', 2), { badges: 20, next: levelOdds(3) }))
    expect(best!.cost.ceiling).toBeCloseTo(102.6113, 3)
    expect(reason).toBe('impossible')
    expect(plan).toMatchObject({ locks: [], buy: null })
    expect(plan!.cost.ceiling).toBeCloseTo(76.2001, 3)
  })

  it('E9: a card locked into level 2 keeps its source from dealing there', () => {
    const asked = at(1, hero('L1'), { badges: 17, cards: packShop, next: levelOdds(2) })
    const { stop, plan, reason } = solve(asked)
    expect(reason).toBe('unaffordable')
    expect(plan).toMatchObject({ locks: [], buy: null })
    expect(stop.cost([], null).ceiling).toBeCloseTo(48.8409, 3)
    // A faction pack came from source 3 or 4, each of which always makes a hero card at level 2.
    expect(stop.cost([1], null).ceiling).toBeCloseTo(49.9325, 3)
    expect(stop.cost([3], null).ceiling).toBeCloseTo(49.2056, 3)
    expect(stop.cost([4], null).ceiling).toBeCloseTo(48.8409, 3)
  })
})

// One source always makes a hero card and the rest never help, so nothing is
// hidden and the cost is 3 ÷ the chance a reroll shows the hero + the price.
describe('a table where one source always makes a hero card', () => {
  const exp = [{ good: 'artifact-exp', percent: 100 }]
  const odds: LevelOdds = [[{ good: 'hero', percent: 100 }], ...Array(7).fill(exp)]
  const two = pools([], HEROES.slice(0, 2))
  const shown = (name: string, more: Partial<ShopCard> = {}) =>
    cards(card('hero', { hero: name, ...more }), ...Array(7).fill(card('artifact-exp')))

  it('costs 3 ÷ ½ + 15 a copy', () => {
    expect(solve({ odds, goal: hero('L1'), pools: two }).best).toMatchObject({ move: REROLL })
    expect(solve({ odds, goal: hero('L1'), pools: two }).best!.cost.ceiling).toBeCloseTo(21, 8)
    expect(solve({ odds, goal: hero('L1', 2), pools: two }).best!.cost.ceiling).toBeCloseTo(42, 8)
  })

  it('buys the hero when it is on show', () => {
    const { best, min } = solve({ odds, goal: hero('L1'), pools: two, cards: shown('L1') })
    expect(best).toEqual({ move: buy(0), cost: { floor: 15, ceiling: 15 } })
    expect(min.cost(REROLL).ceiling).toBeCloseTo(21, 8)
  })

  it('has no answer for a goal no source can help', () => {
    const none: LevelOdds = Array(8).fill(exp)
    const { min, best, plan } = solve({ odds: none, goal: hero('L1'), pools: two })
    expect(min.reachable).toBe(false)
    expect(best).toBeNull()
    expect(plan).toBeNull()
  })

  it('lets go of a lock that holds the only useful source', () => {
    const asked = { odds, goal: hero('L1'), pools: two, cards: shown('L2', { locked: true }) }
    const { best, min } = solve(asked)
    expect(best!.move).toEqual(REROLL)
    expect(best!.cost.ceiling).toBeCloseTo(21, 8)
    expect(min.cost(lock(0)).ceiling).toBeCloseTo(24, 8)
  })

  it('keeps a lock that costs nothing', () => {
    const shop = cards(card('artifact-exp', { locked: true }))
    const { best, min } = solve({ odds, goal: hero('L1'), pools: two, cards: shop })
    expect(min.cost(lock(0)).ceiling).toBeCloseTo(min.cost(REROLL).ceiling, 9)
    expect(best!.move).toEqual(lock(0))
  })

  it('compares the ways to stop on one footing', () => {
    const asked = { odds, goal: hero('L1', 2), pools: two, cards: shown('L1') }
    const { stop } = solve(asked)
    expect(stop.cost([], 0).ceiling).toBeCloseTo(15 + 21 - 3, 8)
    expect(stop.cost([0], null).ceiling).toBeCloseTo(36, 8)
    expect(stop.cost([], null).ceiling).toBeCloseTo(42 - 3, 8)
    const rich = solve({ ...asked, badges: 18 })
    expect(rich.reason).toBe('impossible')
    expect(rich.plan).toMatchObject({ locks: [], buy: 0 })
    expect(solve({ ...asked, badges: 10 }).plan).toMatchObject({ locks: [0], buy: null })
  })

  it('locks a piece it cannot pay for, unless the piece is sure to show again', () => {
    const gear: LevelOdds = [[{ good: 'elite-equipment', percent: 100 }], ...Array(7).fill(exp)]
    const goal: Goal = { heroes: [], equipment: [{ name: 'blade', tier: 'elite' }], copies: 1 }
    const shop = cards(card('elite-equipment', { equipment: 'blade' }))
    const of = (size: number) => ({ ...pools(), equipment: { elite: size } })
    expect(solve({ odds: gear, goal, pools: of(4) }).best!.cost.ceiling).toBeCloseTo(32, 8)
    const four = solve({ odds: gear, goal, pools: of(4), cards: shop, badges: 10 })
    expect(four.reason).toBe('unaffordable')
    expect(four.plan).toMatchObject({ locks: [0], buy: null })
    expect(four.plan!.cost.ceiling).toBeCloseTo(20, 8)
    expect(solve({ odds: gear, goal, pools: of(1), cards: shop, badges: 10 }).plan!.locks).toEqual(
      [],
    )
  })
})

describe('stopping', () => {
  it('stops only when the move cannot be paid for or cannot finish this round', () => {
    const mixed: LevelOdds = [
      [
        { good: 'random-pack', percent: 40 },
        { good: 'hero', percent: 40 },
        { good: 'artifact-exp', percent: 20 },
      ],
      ...Array(7).fill([{ good: 'artifact-exp', percent: 100 }]),
    ]
    const two = pools([], HEROES.slice(0, 2))
    const shop = cards(...Array(8).fill(card('artifact-exp')))
    const ask = (badges: number, copies: number, shown = shop) =>
      solve({ odds: mixed, goal: hero('L1', copies), pools: two, badges, cards: shown })
    // A reroll leaves 15: one hero card, or no pack, so two copies cannot be reached.
    expect(ask(18, 2).best!.move.kind).toBe('reroll')
    expect(ask(18, 2).reason).toBe('impossible')
    expect(ask(33, 2).reason).toBeNull()
    const single = cards(card('hero', { hero: 'L1' }), ...Array(7).fill(card('artifact-exp')))
    expect(ask(10, 1, single).reason).toBe('unaffordable')
    expect(ask(15, 1, single).reason).toBeNull()
  })

  it('with a pack on show and 18 badges for two copies, stops without buying it', () => {
    const shop = cards(card('random-pack'))
    const { best, min, reason, plan } = solve(
      at(2, hero('L1', 2), { badges: 18, cards: shop, pools: pools(others) }),
    )
    expect(best!.move.kind).toBe('reroll')
    expect(min.cost(buy(0)).ceiling).toBeGreaterThan(best!.cost.ceiling + 5)
    expect(reason).toBe('impossible')
    expect(plan!.buy).toBeNull()
  })

  // Two copies wanted, 18 badges. The hero's card is on show in a source that
  // always makes a hero card, and every other place shows something its own
  // source makes. Level 5 often shows two-copy cards, so a lock keeps the
  // choice of skipping the single one.
  it('buys before stopping at levels 3 and 4, and locks at level 5', () => {
    const ask = (level: number) => {
      const odds = levelOdds(level)
      const sure = odds.findIndex((source) => source[0]!.good === 'hero' && source.length === 1)
      const shop = odds.map((source, place) => {
        if (place === sure) return card('hero', { hero: 'L1' })
        const plain = source.find((entry) => !/pack|hero/.test(entry.good))
        return plain ? card(plain.good) : card(source[0]!.good, { hero: 'G8' })
      })
      const solved = solve({ odds, goal: hero('L1', 2), badges: 18, cards: shop })
      return {
        ...solved,
        sure,
        bought: solved.stop.cost([], sure).ceiling,
        locked: solved.stop.cost([sure], null).ceiling,
      }
    }
    const three = ask(3)
    expect(three.reason).toBe('impossible')
    expect(three.plan).toMatchObject({ locks: [], buy: three.sure })
    expect(three.bought).toBeCloseTo(52.223, 2)
    expect(three.locked).toBeCloseTo(52.94, 2)
    const four = ask(4)
    expect(four.plan).toMatchObject({ locks: [], buy: four.sure })
    expect(four.bought).toBeCloseTo(51.623, 2)
    expect(four.locked).toBeCloseTo(52.192, 2)
    const five = ask(5)
    expect(five.plan).toMatchObject({ locks: [five.sure], buy: null })
    expect(five.locked).toBeCloseTo(52.609, 2)
    expect(five.bought).toBeCloseTo(53.669, 2)
  })

  it('waits for a higher level only when that beats carrying on by more than a reroll', () => {
    const ask = (level: number, shop = cards()) =>
      solve(at(level, hero('L1'), { cards: shop, next: levelOdds(level + 1) }))
    const one = ask(1, cards(card('random-pack'), card(), card('graveborn-pack')))
    expect(one.best!.cost.ceiling).toBeGreaterThan(100)
    expect(one.reason).toBe('next-level')
    expect(one.plan).toMatchObject({ locks: [], buy: null })
    expect(one.plan!.cost.ceiling).toBeCloseTo(48.8409, 3)
    expect(ask(2).reason).toBe('next-level')
    expect(ask(3).reason).toBe('next-level')
    // Level 5 costs 38.67 from a free shop: with a reroll added that is not below 39.62.
    const four = ask(4)
    expect(four.best!.cost.ceiling).toBeCloseTo(39.6229, 3)
    expect(four.plan!.cost.ceiling).toBeCloseTo(38.6688, 3)
    expect(four.reason).toBeNull()
    const shown = ask(3, cards(card(), card(), card('hero', { hero: 'L1' })))
    expect(shown.best!.move).toEqual(buy(2))
    expect(shown.reason).toBeNull()
  })
})

describe('a level rise', () => {
  it('carries a piece into a level that never makes it, to buy it there', () => {
    const exp = [{ good: 'artifact-exp', percent: 100 }]
    const rare: LevelOdds = [[{ good: 'rare-equipment', percent: 100 }], ...Array(7).fill(exp)]
    const goal: Goal = { heroes: [], equipment: [{ name: 'blade', tier: 'rare' }], copies: 1 }
    const { stop, plan } = solve({
      odds: rare,
      next: Array(8).fill(exp),
      goal,
      badges: 5,
      cards: cards(card('rare-equipment', { equipment: 'blade' })),
      pools: { ...pools(), equipment: { rare: 4 } },
    })
    expect(stop.cost([], null).ceiling).toBe(Infinity)
    expect(stop.cost([0], null).ceiling).toBe(10)
    expect(plan).toMatchObject({ locks: [0], buy: null })
  })
})

describe('rules that always hold', () => {
  const busy = cards(
    card('hero', { hero: 'L1' }),
    card('hero', { hero: 'M3', locked: true }),
    card('hero-pair', { hero: 'L1' }),
    card('legendary-hero'),
    card('elite-equipment', { equipment: 'blade', locked: true }),
    card('hero-pair', { hero: 'W2' }),
  )

  it('every first move and every way to stop has its floor at or under its ceiling', () => {
    for (const copies of [1, 2, 3, 4]) {
      const { min, stop, moves } = solve(at(5, hero('L1', copies), { cards: busy }))
      for (const move of moves) {
        const cost = min.cost(move)
        expect(cost.floor).toBeLessThanOrEqual(cost.ceiling + 1e-9)
        expect(cost.ceiling - cost.floor).toBeLessThan(0.1)
      }
      for (const plan of stop.plans(moves)) {
        expect(plan.cost.floor).toBeLessThanOrEqual(plan.cost.ceiling + 1e-9)
      }
    }
  })

  it('a reroll costs what stopping with the same locks costs, and 3 more', () => {
    const { min, stop, moves } = solve(
      at(4, hero('L1', 3), { cards: busy.slice(0, 3).concat(cards().slice(3)) }),
    )
    for (const move of moves) {
      if (move.kind !== 'reroll') continue
      expect(min.cost(move).ceiling).toBeCloseTo(stop.cost(move.locks, null).ceiling + 3, 9)
    }
  })

  it('more copies never cost less, and heroes sold never cost more', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      let last = 0
      for (const copies of [1, 2, 3, 4]) {
        const kept = solve(at(level, hero('L1', copies))).best!.cost.ceiling
        const sold = solve(at(level, hero('L1', copies), { pools: pools(others) })).best!.cost
        expect(kept).toBeGreaterThan(last)
        expect(sold.ceiling).toBeLessThanOrEqual(kept + 1e-9)
        last = kept
      }
    }
  })

  it('answers from a cache kept through a visit as a fresh solve does', () => {
    const kept = createSolverCache()
    const shop = { badges: 60, cards: busy }
    for (const copies of [1, 3, 2, 4]) {
      const goal = hero('L1', copies)
      const visit = solveMinBadges(shop, goal, levelOdds(5), pools(), FACTS, kept)!
      const fresh = solveMinBadges(shop, goal, levelOdds(5), pools(), FACTS)!
      for (const move of [REROLL, lock(0), buy(2), buy(3)]) {
        expect(visit.cost(move)).toEqual(fresh.cost(move))
      }
    }
  })

  it('the order of the eight cards changes nothing', () => {
    const order = [5, 2, 7, 0, 3, 6, 1, 4]
    const moved = order.map((from) => busy[from]!)
    const a = solve(at(5, hero('L1', 3), { cards: busy })).min
    const b = solve(at(5, hero('L1', 3), { cards: moved })).min
    const to = (from: number) => order.indexOf(from)
    expect(b.cost(buy(to(2))).ceiling).toBeCloseTo(a.cost(buy(2)).ceiling, 9)
    expect(b.cost(lock(to(0), to(4))).ceiling).toBeCloseTo(a.cost(lock(0, 4)).ceiling, 9)
    expect(b.cost(REROLL).ceiling).toBeCloseTo(a.cost(REROLL).ceiling, 9)
  })
})
