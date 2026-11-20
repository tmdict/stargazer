import { describe, expect, it } from 'vitest'

import {
  calculateShop,
  type ShopAnswer,
  type ShopRequest,
  type ShopResult,
} from '@/lib/hd/shop/calculate'
import { goalModel } from '@/lib/hd/shop/moves'
import { solveOffers } from '@/lib/hd/shop/offers'
import { createSolverCache } from '@/lib/hd/shop/solverCache'
import type {
  LevelOdds,
  Move,
  OddsTable,
  Pools,
  ShopCard,
  WantedEquipment,
} from '@/lib/hd/shop/types'
import {
  buy,
  card,
  cards,
  FACTS,
  hero,
  HEROES,
  lock,
  ODDS,
  pools,
  REROLL,
} from '../../fixtures/hdShop'

const exp = [{ good: 'artifact-exp', percent: 100 }]
const filler = (count: number): ShopCard[] => Array(count).fill(card('artifact-exp'))
const two = pools([], HEROES.slice(0, 2))
const everyLevel = (odds: LevelOdds): OddsTable => ({ levels: Array(5).fill(odds) })

interface Asked {
  odds?: LevelOdds
  table?: OddsTable
  level?: number
  rises?: boolean
  badges?: number
  cards?: ShopCard[]
  heroes?: [name: string, copies?: number][]
  equipment?: WantedEquipment[]
  pools?: Pools
  startFrom?: Move
}

const request = (asked: Asked): ShopRequest => ({
  level: asked.level ?? 1,
  rises: asked.rises ?? (asked.level ?? 1) === 1,
  shop: { badges: asked.badges ?? 60, cards: asked.cards ?? cards() },
  heroes: (asked.heroes ?? [['L1']]).map(([name, copies = 1]) => ({ name, copies })),
  equipment: asked.equipment ?? [],
  pools: asked.pools ?? two,
  startFrom: asked.startFrom,
})

// Every step of a calculation: its results, and a null for each pause.
const steps = (asked: Asked, searchMs = 5000, sliceMs = 50): (ShopResult | null)[] => [
  ...calculateShop(
    request(asked),
    asked.table ?? (asked.odds ? everyLevel(asked.odds) : ODDS),
    FACTS,
    createSolverCache(),
    searchMs,
    sliceMs,
  ),
]

const stages = (asked: Asked, searchMs?: number): ShopResult[] =>
  steps(asked, searchMs).filter((step) => step !== null)

/** The settled answers, by the wanted item's name or the kind of an "any" goal. */
function answers(asked: Asked): Record<string, ShopAnswer> {
  const last = stages(asked).at(-1)!
  return Object.fromEntries(
    last.answers.map((answer) => [
      'name' in answer.goal ? answer.goal.name : answer.goal.kind,
      answer,
    ]),
  )
}

describe('the goals of a request', () => {
  const kinds = (asked: Asked) => Object.keys(answers(asked))

  it('adds the "any" goals only when they cover other targets than a goal before them', () => {
    const piece: WantedEquipment = { name: 'e1', tier: 'epic' }
    expect(kinds({ odds: ODDS.levels[4], pools: pools() })).toEqual(['L1'])
    expect(kinds({ odds: ODDS.levels[4], pools: pools(), heroes: [['L1'], ['M1']] })).toEqual([
      'L1',
      'M1',
      'any-hero',
    ])
    expect(kinds({ odds: ODDS.levels[4], pools: pools(), equipment: [piece] })).toEqual([
      'L1',
      'e1',
      'any',
    ])
  })

  it('never adds up copies of different heroes', () => {
    const asked = { odds: ODDS.levels[4], pools: pools(), heroes: [['L1', 2], ['M1']] } as Asked
    expect(kinds(asked)).toEqual(['L1', 'M1'])
  })

  it('leaves out a goal that spans targets once kept cards make it too large', () => {
    const asked: Asked = {
      level: 4,
      rises: false,
      badges: 10,
      heroes: [['L1'], ['M1'], ['W1'], ['G1']],
      equipment: [
        { name: 'r1', tier: 'rare' },
        { name: 'e1', tier: 'elite' },
        { name: 'p1', tier: 'epic' },
      ],
      pools: pools(),
    }
    const kept = cards(
      card('random-pack', { locked: true, lockedAt: 1 }),
      card('lightbearer-pack', { locked: true, lockedAt: 1 }),
      card('mauler-pack', { locked: true, lockedAt: 1 }),
      card('hero', { hero: 'W1', locked: true, lockedAt: 3 }),
      card('rare-equipment', { equipment: 'r1', locked: true, lockedAt: 3 }),
    )
    const items = ['L1', 'M1', 'W1', 'G1', 'r1', 'e1', 'p1']
    expect(stages(asked).at(-1)).toMatchObject({ skipped: [] })
    expect(kinds(asked)).toEqual([...items, 'any-hero', 'any-equipment', 'any'])
    expect(stages({ ...asked, cards: kept }).at(-1)).toMatchObject({ skipped: [{ kind: 'any' }] })
    expect(kinds({ ...asked, cards: kept })).toEqual([...items, 'any-hero', 'any-equipment'])
  })

  it('leaves out a goal that spans targets when it is too large at the level the shop rises to', () => {
    const asked: Asked = {
      level: 3,
      rises: false,
      badges: 10,
      heroes: [['L1'], ['M1'], ['W1'], ['G1']],
      equipment: [
        { name: 'r1', tier: 'rare' },
        { name: 'e1', tier: 'elite' },
        { name: 'p1', tier: 'epic' },
      ],
      pools: pools(),
      cards: cards(
        card('random-pack', { locked: true, lockedAt: 1 }),
        card('lightbearer-pack', { locked: true, lockedAt: 1 }),
        card('rare-equipment', { equipment: 'r1', locked: true, lockedAt: 1 }),
        card('hero', { hero: 'L1', locked: true, lockedAt: 2 }),
        card('rare-equipment', { equipment: 'r1', locked: true, lockedAt: 2 }),
        card('hero', { hero: 'M1' }),
        card('rare-equipment', { equipment: 'r1' }),
      ),
    }
    expect(stages(asked).at(-1)).toMatchObject({ skipped: [] })
    expect(stages({ ...asked, rises: true }).at(-1)).toMatchObject({ skipped: [{ kind: 'any' }] })
  })

  it('leaves out a wanted item whose own tables kept cards, copies and badges make too large', () => {
    const asked: Asked = {
      level: 5,
      rises: false,
      badges: 500,
      heroes: [['L1', 4], ['G1'], ['G2'], ['M1'], ['W1']],
      pools: pools(),
      cards: cards(
        card('legendary-hero', { locked: true, lockedAt: 4 }),
        card('hero-pair', { hero: 'M2', locked: true, lockedAt: 4 }),
        card('random-pack', { locked: true, lockedAt: 1 }),
        card('lightbearer-pack', { locked: true, lockedAt: 2 }),
        card('lightbearer-pack', { locked: true, lockedAt: 1 }),
        card('hero', { hero: 'M1', locked: true, lockedAt: 3 }),
      ),
    }
    // The four single copies fit only because they share one set of tables.
    const singles = ['G1', 'G2', 'M1', 'W1']
    expect(stages(asked).at(-1)).toMatchObject({
      skipped: [{ kind: 'hero', name: 'L1' }],
      answers: singles.map((name) => ({ goal: { kind: 'hero', name } })),
    })
    expect(kinds({ ...asked, badges: 10 })).toEqual(['L1', ...singles])
  })

  it('buys a wanted piece kept locked into a level that no longer sells its rarity', () => {
    const piece: WantedEquipment = { name: 'r1', tier: 'rare' }
    const shop = cards(card('rare-equipment', { equipment: 'r1', locked: true }), card('hero'))
    const { r1 } = answers({
      level: 4,
      cards: shop,
      heroes: [],
      equipment: [piece],
      pools: pools(),
    })
    expect(r1!.chance.best!.move).toEqual(buy(0))
    expect(r1!.chance.best!.chance.floor).toBe(1)
    expect(r1!.badges.best!.move).toEqual(buy(0))
  })
})

// One source always makes a hero card, of L1 or L2, and the rest never help.
describe('which move best chance shows', () => {
  const odds: LevelOdds = [[{ good: 'hero', percent: 100 }], ...Array(7).fill(exp)]
  const shown = (name: string, locked = false) =>
    cards(card('hero', { hero: name, locked }), ...filler(7))

  it('buys a wanted card on show, where keeping it through a reroll shows the same', () => {
    const kept = answers({ odds, badges: 18, cards: shown('L1', true) }).L1!
    expect(kept.chance.best!.move).toEqual(buy(0))
    const open = answers({ odds, cards: shown('L1') }).L1!
    expect(open.chance.best!.move).toEqual(buy(0))
    expect(open.chance.current!.chance.floor).toBeLessThan(1)
  })

  it('keeps the locks as entered when letting one go shows no gain', () => {
    const shop = cards(card('artifact-exp', { locked: true }))
    const { chance } = answers({ odds, cards: shop }).L1!
    expect(chance.best!.move).toEqual(lock(0))
    expect(chance.current).toBeNull()
  })

  it('never advises buying another target, and stops when nothing can reach the goal', () => {
    // A reroll leaves 12 badges, under the price of a hero card.
    const both = answers({ odds, badges: 15, cards: shown('L2'), heroes: [['L1'], ['L2']] })
    expect(both.L1!.chance.best).toBeNull()
    expect(both.L1!.stopPlan).not.toBeNull()
    expect(both.L2!.chance.best!.move).toEqual(buy(0))
  })

  it('shows the best move that leaves another target locked beside the best one', () => {
    const asked = { odds, badges: 18, cards: shown('L2', true), heroes: [['L1'], ['L2']] } as Asked
    const { L1, L2 } = answers(asked)
    expect(L1!.chance.best!.move).toEqual(REROLL)
    expect(L1!.chance.keepLocks!.move).toEqual(lock(0))
    expect(L1!.chance.best!.chance.floor).toBeGreaterThan(L1!.chance.keepLocks!.chance.floor)
    // Letting the lock go costs 3 ÷ ½ + 15; keeping it wastes one reroll.
    expect(L1!.badges.best).toMatchObject({ move: REROLL })
    expect(L1!.badges.best!.cost.ceiling).toBeCloseTo(21, 6)
    expect(L1!.badges.keepLocks!.move).toEqual(lock(0))
    expect(L1!.badges.keepLocks!.cost.ceiling).toBeCloseTo(24, 6)
    expect(L2!.badges.keepLocks).toBeNull()
  })

  it('lets go of the one lock that costs badges, and offers no second row that only differs in locks', () => {
    const shop = cards(
      card('hero', { hero: 'L2', locked: true }),
      ...Array(4).fill(card('artifact-exp', { locked: true })),
    )
    const { badges } = answers({ odds, cards: shop }).L1!
    expect(badges.best!.move).toEqual(lock(1, 2, 3, 4))
    expect(badges.best!.cost.ceiling).toBeCloseTo(21, 6)
    expect(badges.next).toBeNull()
  })

  it('starts the comparison from a move the player chose', () => {
    const asked = { odds, badges: 18, cards: shown('L2'), heroes: [['L1'], ['L2']] } as Asked
    const { chance } = answers({ ...asked, startFrom: lock(0) }).L1!
    expect(chance.best!.move).toEqual(REROLL)
    expect(chance.current!.move).toEqual(lock(0))
  })
})

// Two sources always make a hero card and the last always an Epic piece.
describe('locks on other targets', () => {
  const sure = (good: string) => [{ good, percent: 100 }]
  const odds: LevelOdds = [
    sure('hero'),
    sure('hero'),
    ...Array(5).fill(exp),
    sure('epic-equipment'),
  ]
  const shop = cards(
    card('hero', { hero: 'L1', locked: true }),
    card('hero'),
    ...filler(5),
    card('epic-equipment', { equipment: 'e1', locked: true }),
  )
  const asked = (badges: number): Asked => ({
    odds,
    badges,
    cards: shop,
    heroes: [['L1', 2], ['L2']],
    equipment: [
      { name: 'e1', tier: 'epic' },
      { name: 'e2', tier: 'epic' },
    ],
  })

  it('lets go of a lock that holds a useful source, and keeps one that does not', () => {
    const { L2 } = answers(asked(18))
    expect(L2!.chance.best!.move).toEqual(lock(7))
    expect(L2!.badges.best!.move).toEqual(lock(7))
    expect(L2!.badges.keepLocks!.move).toEqual(lock(0, 7))
    expect(L2!.badges.keepLocks!.cost.ceiling).toBeGreaterThan(L2!.badges.best!.cost.ceiling + 0.5)
  })

  it('names the locks whose sources never make the goal', () => {
    const found = answers(asked(18))
    expect(found.L2!.idleLocks).toEqual([7])
    expect(found.L1!.idleLocks).toEqual([7])
    expect(found.e2!.idleLocks).toEqual([0])
  })

  it('names a lock whose source made the card only at the level it was locked at', () => {
    const lockedLow = cards(
      card('hero', { hero: 'L1', locked: true, lockedAt: 1 }),
      card('hero'),
      ...filler(6),
    )
    const table = {
      levels: [
        [sure('hero'), ...Array(7).fill(exp)],
        [exp, sure('hero'), ...Array(6).fill(exp)],
      ],
    }
    const found = answers({
      table,
      level: 2,
      rises: false,
      cards: lockedLow,
      heroes: [['L1'], ['L2']],
    })
    expect(found.L2!.idleLocks).toEqual([0])
  })
})

describe('packs on show', () => {
  const pack = (good: string) => [{ good, percent: 100 }]
  const four = pools([], [...HEROES.slice(0, 2), ...HEROES.slice(8, 10)])

  it('buys the cheaper way first when two purchases give the same chance', () => {
    // 51 badges buy both packs in either order. The Lightbearer pack holds L1
    // far more often for its price.
    const pool = pools(
      [],
      [0, 1, 8, 9, 16, 17, 24, 25].map((at) => HEROES[at]!),
    )
    const odds: LevelOdds = [pack('random-pack'), pack('lightbearer-pack'), ...Array(6).fill(exp)]
    const shop = cards(card('random-pack'), card('lightbearer-pack'), ...filler(6))
    const { chance } = answers({ odds, badges: 51, cards: shop, pools: pool }).L1!
    expect(chance.best!.move).toEqual(buy(1))
  })

  const offers = (badges: number, goods: string[], pool: Pools, copies = 1) => {
    const odds: LevelOdds = [...goods.map(pack), ...Array(8 - goods.length).fill(exp)]
    const shop = { badges, cards: cards(...goods.map((good) => card(good)), ...filler(6)) }
    const model = goalModel(hero('L1', copies), odds, pool, FACTS)
    return solveOffers(shop, model, FACTS, [0, 1, 2, 3, 4, 5, 6, 7])
  }

  it('buys only what the badges cover, and never the same card twice', () => {
    const packs = ['random-pack', 'random-pack']
    expect(offers(35, packs, two).chance).toBeCloseTo(7 / 8, 9)
    expect(offers(36, packs, two).chance).toBeCloseTo(63 / 64, 9)
    expect(offers(60, ['random-pack'], two).chance).toBeCloseTo(7 / 8, 9)
  })

  it('picks the pack that fits the badges, or both', () => {
    const packs = ['random-pack', 'lightbearer-pack']
    expect(offers(18, packs, four).chance).toBeCloseTo(1 - (3 / 4) ** 3, 9)
    expect(offers(33, packs, four)).toMatchObject({ first: 1 })
    expect(offers(33, packs, four).chance).toBeCloseTo(7 / 8, 9)
    expect(offers(51, packs, four).chance).toBeCloseTo(1 - (3 / 4) ** 3 * (1 / 2) ** 3, 9)
  })

  it('spends badges from sold heroes only once a pack has given them', () => {
    const packs = ['random-pack', 'random-pack']
    const selling = pools(['L2'], four.heroes)
    expect(offers(17, packs, selling).chance).toBe(0)
    expect(offers(34, packs, four).chance).toBeCloseTo(37 / 64, 9)
    // The second pack is paid for only when the first held L2 at least once and not L1.
    const again = (27 / 64) * (1 - (2 / 3) ** 3) * (37 / 64)
    expect(offers(34, packs, selling).chance).toBeCloseTo(37 / 64 + again, 9)
  })
})

describe('stopping', () => {
  const mixed: LevelOdds = [
    [
      { good: 'random-pack', percent: 40 },
      { good: 'hero', percent: 40 },
      { good: 'artifact-exp', percent: 20 },
    ],
    ...Array(7).fill(exp),
  ]
  const ask = (badges: number, shop = cards(...filler(8))) =>
    answers({ odds: mixed, badges, cards: shop, heroes: [['L1', 2]] }).L1!

  it('stops both answers when a reroll leaves too little for two copies', () => {
    const poor = ask(18)
    expect(poor.chance).toMatchObject({ best: null, keepLocks: null })
    expect(poor.badges.best!.move.kind).toBe('reroll')
    expect(poor.badges.stop).toBe('impossible')
    expect(poor.stopPlan).not.toBeNull()
  })

  it('waits for the next shop level only when the level goes up next round', () => {
    const shop = cards(card('random-pack'), card(), card('graveborn-pack'))
    const at = (level: number, rises: boolean, shown = cards()) =>
      answers({ level, rises, cards: shown, pools: pools() }).L1!
    const first = at(1, true, shop)
    expect(first.badges.stop).toBe('next-level')
    expect(first.stopPlan).toMatchObject({ locks: [], buy: null })
    expect(at(2, false).badges.stop).toBeNull()
    expect(at(2, true).badges.stop).toBe('next-level')
  })
})

describe('answers in stages', () => {
  const heavy: Asked = { level: 5, badges: 150, heroes: [['L1', 4]], pools: pools() }
  const best = (result: ShopResult) => result.answers[0]!.chance.best!

  it('gives every row as a range first, then the searched answer inside it', () => {
    const [first, ...later] = stages(heavy)
    const last = later.at(-1)!
    expect(first).toMatchObject({ settled: false })
    expect(last).toMatchObject({ settled: true })
    const range = best(first!).chance
    const found = best(last).chance
    expect(range.floor).toBeLessThan(range.ceiling)
    expect(found.floor).toBe(found.ceiling)
    expect(found.floor).toBeGreaterThanOrEqual(range.floor - 1e-9)
    expect(found.floor).toBeLessThanOrEqual(range.ceiling + 1e-9)
  })

  it('keeps the range when the search runs out of time', () => {
    const [first, last] = stages(heavy, 0)
    expect(last).toMatchObject({ settled: true })
    expect(best(last!)).toEqual(best(first!))
  })

  it('gives the same answers when the search is cut into slices', () => {
    const sliced = steps(heavy, undefined, 1)
    expect(sliced.filter((step) => step === null).length).toBeGreaterThan(1)
    expect(sliced.at(-1)).toEqual(stages(heavy).at(-1))
  })

  it('settles at once when the tables leave nothing to search', () => {
    const odds: LevelOdds = [[{ good: 'hero', percent: 100 }], ...Array(7).fill(exp)]
    expect(stages({ odds })).toMatchObject([{ settled: true }])
  })
})
