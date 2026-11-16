import { describe, expect, it } from 'vitest'

import odds from '@/data/hd/shop/odds.json'
import { checkShopFacts, SHOP_FACTS } from '@/lib/hd/shop/goods'
import { goalModel } from '@/lib/hd/shop/moves'
import { checkOdds } from '@/lib/hd/shop/odds'
import { sampleShop } from '@/lib/hd/shop/sample'
import { readShop } from '@/lib/hd/shop/sources'
import type { OddsTable, ShopCard } from '@/lib/hd/shop/types'
import { card, cards, FACTS, hero, HEROES, levelOdds, ODDS, pools } from '../../fixtures/hdShop'

describe('reading the shop', () => {
  it('refuses eight Epic equipment cards at level 1', () => {
    const shop = cards(...Array.from({ length: 8 }, () => card('epic-equipment')))
    expect(readShop(levelOdds(1), shop)).toBeNull()
  })

  it('gives a card to the only source that makes its product, and spreads the rest', () => {
    const odds = [
      [{ good: 'random-pack', percent: 100 }],
      [
        { good: 'hero', percent: 25 },
        { good: 'artifact-exp', percent: 75 },
      ],
      [
        { good: 'hero', percent: 75 },
        { good: 'artifact-exp', percent: 25 },
      ],
    ]
    const reading = readShop(odds, [card('hero'), card('random-pack'), card()])!
    expect(reading.cards).toEqual([0, 1])
    expect(reading.worlds).toEqual([
      { origins: [1, 0], chance: 0.25 },
      { origins: [2, 0], chance: 0.75 },
    ])
  })

  it('lets a locked blank card hold a source', () => {
    const odds = [[{ good: 'hero', percent: 100 }], [{ good: 'random-pack', percent: 100 }]]
    const reading = readShop(odds, [card(null, { locked: true }), card('hero')])!
    expect(reading.worlds).toEqual([{ origins: [1, 0], chance: 1 }])
  })
})

describe('an example shop', () => {
  // Stands in for Math.random with numbers that repeat, so a failure can be run again.
  const repeating = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const names = {
    heroes: HEROES.map((one) => one.name),
    equipment: (['rare', 'elite', 'epic'] as const).map((tier) => ({ name: `${tier}-1`, tier })),
  }

  it('is one its level can show, each hero or piece taken from the lists given', () => {
    const random = repeating(1)
    // What a card should name: one of the heroes, the piece of its rarity, or nothing.
    const named = (shown: ShopCard): boolean => {
      const good = FACTS.goods.find((one) => one.name === shown.good)!
      if (good.kind === 'hero') return names.heroes.includes(shown.hero ?? '')
      if (good.kind === 'equipment') return shown.equipment === `${good.tier}-1`
      return !shown.hero && !shown.equipment
    }
    for (let level = 1; level <= 5; level++) {
      for (let n = 0; n < 40; n++) {
        const shop = sampleShop(levelOdds(level), FACTS, names, random)
        expect(readShop(levelOdds(level), shop)).not.toBeNull()
        expect(shop.filter((shown) => !named(shown))).toEqual([])
      }
    }
  })
})

describe('a pack', () => {
  const two = HEROES.slice(0, 2)
  const outcomes = (copies: number) =>
    goalModel(hero('L1', copies), [[{ good: 'random-pack', percent: 100 }]], pools([], two), FACTS)
      .kinds[0]!.outcomes
  const atLeast = (gain: number) =>
    outcomes(2)
      .filter((outcome) => outcome.gain >= gain)
      .reduce((sum, outcome) => sum + outcome.chance, 0)

  it('picks three heroes, each on its own, from its pool', () => {
    expect(atLeast(1)).toBeCloseTo(7 / 8, 12)
    expect(atLeast(2)).toBeCloseTo(1 / 2, 12)
  })

  it('hands back the sale value of each hero marked Sell, but not of a wanted one', () => {
    const model = goalModel(
      hero('L1'),
      [[{ good: 'random-pack', percent: 100 }]],
      pools(['L1', 'L2'], two),
      FACTS,
    )
    const refunds = model.kinds[0]!.outcomes.map((outcome) => [outcome.gain, outcome.refund])
    expect(refunds).toContainEqual([0, 3 * FACTS.sell])
    expect(refunds).toContainEqual([3, 0])
  })
})

describe('checking the data', () => {
  it('accepts the measured odds table the site ships', () => {
    expect(() => checkOdds(odds as OddsTable, SHOP_FACTS)).not.toThrow()
  })

  it('refuses an odds table whose source does not add up to 100', () => {
    const levels = structuredClone(ODDS.levels)
    levels[2]![4]![0]!.percent += 1
    expect(() => checkOdds({ levels } as OddsTable, FACTS)).toThrow(/level 3, source 5/)
  })

  it('refuses an odds table that names an unknown product', () => {
    const levels = structuredClone(ODDS.levels)
    levels[0]![0]![0]!.good = 'mystery-box'
    expect(() => checkOdds({ levels } as OddsTable, FACTS)).toThrow(/mystery-box/)
  })

  // The solvers work from the fewest badges up, so no purchase may pay for itself.
  it('refuses a product that can hand back its own price', () => {
    const goods = FACTS.goods.map((good) =>
      good.name === 'random-pack' ? { ...good, price: 3 * FACTS.sell } : good,
    )
    expect(() => checkShopFacts({ ...FACTS, goods })).toThrow(/random-pack/)
  })
})
