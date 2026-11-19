import { describe, expect, it } from 'vitest'

import { goalModel } from '@/lib/hd/shop/moves'
import { checkOdds } from '@/lib/hd/shop/odds'
import { sampleShop } from '@/lib/hd/shop/sample'
import { readShop, sourcesOf } from '@/lib/hd/shop/sources'
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
    expect(reading.cards).toEqual([1, 0])
    expect(reading.worlds).toEqual([{ origins: [0, 1], chance: 1 }])
  })

  it('keeps some of the locked blank cards as every way of handing out their sources would', () => {
    const odds = levelOdds(2)
    const blank = card(null, { locked: true })
    const reading = readShop(odds, [blank, card('hero'), blank, blank, card('rare-equipment')])!
    expect(reading.cards).toEqual([1, 4, 0, 2, 3])

    // The hero card, and the first two blank cards for the sources they hold together.
    const seen = (hero: number, held: number[]) => `${hero}|${held.sort().join()}`
    const share = (good: string, source: number) =>
      odds[source]!.reduce((sum, entry) => sum + (entry.good === good ? entry.percent : 0), 0)
    const expected = new Map<string, number>()
    let total = 0
    const sources = odds.map((_, source) => source)
    for (const hero of sources) {
      for (const piece of sources) {
        for (const a of sources) {
          for (const b of sources) {
            for (const c of sources) {
              if (new Set([hero, piece, a, b, c]).size < 5) continue
              const weight = share('hero', hero) * share('rare-equipment', piece)
              expected.set(seen(hero, [a, b]), (expected.get(seen(hero, [a, b])) ?? 0) + weight)
              total += weight
            }
          }
        }
      }
    }

    const found = new Map<string, number>()
    for (const world of sourcesOf(reading, [0, 2, 3])) {
      const key = seen(world.origins[0]!, world.origins.slice(1))
      found.set(key, (found.get(key) ?? 0) + world.chance)
    }
    expect([...found.keys()].sort()).toEqual(
      [...expected.keys()].filter((key) => expected.get(key)).sort(),
    )
    for (const [key, chance] of found) expect(chance).toBeCloseTo(expected.get(key)! / total, 12)
  })

  it('reads a locked card of a product its level never makes against the level below', () => {
    const lower = [levelOdds(3), levelOdds(2), levelOdds(1)]
    const kept = cards(card('rare-equipment', { locked: true }), card('hero'))
    expect(readShop(levelOdds(4), kept)).toBeNull()

    // At level 3 only the first and the fifth source make Rare equipment.
    const reading = readShop(levelOdds(4), kept, lower)!
    expect(new Set(reading.worlds.map((world) => world.origins[0]))).toEqual(new Set([0, 4]))
    expect(reading.odds[0]).toContainEqual({ good: 'rare-equipment', percent: 0 })
    expect(reading.odds[1]).toEqual(levelOdds(4)[1])

    const open = cards(card('rare-equipment'), card('hero'))
    expect(readShop(levelOdds(4), open, lower)).toBeNull()

    // Bought, the card was still locked until then.
    const bought = cards(card('rare-equipment', { bought: true }), card('hero'))
    const after = readShop(levelOdds(4), bought, lower)!
    expect(new Set(after.worlds.map((world) => world.origins[0]))).toEqual(new Set([0, 4]))
  })

  it('reads a locked card against the level it names, though its own level makes the product', () => {
    const lower = [levelOdds(3), levelOdds(2), levelOdds(1)]
    const origins = (shown: ShopCard) =>
      new Set(readShop(levelOdds(4), cards(shown), lower)!.worlds.map((world) => world.origins[0]))

    // The first six sources make Hero cards at level 4, the third to the seventh at level 3.
    expect(origins(card('hero', { locked: true }))).toEqual(new Set([0, 1, 2, 3, 4, 5]))
    expect(origins(card('hero', { locked: true, lockedAt: 3 }))).toEqual(new Set([2, 3, 4, 5, 6]))
    expect(origins(card('hero', { bought: true, lockedAt: 3 }))).toEqual(new Set([2, 3, 4, 5, 6]))

    const kept = cards(card('hero', { locked: true, lockedAt: 3 }))
    const reading = readShop(levelOdds(4), kept, lower)!
    expect(reading.odds[6]).toContainEqual({ good: 'hero', percent: 0 })
    expect(reading.odds[2]).toEqual(levelOdds(4)[2])

    // Level 1 sells no Hero cards.
    expect(
      readShop(levelOdds(4), cards(card('hero', { locked: true, lockedAt: 1 })), lower),
    ).toBeNull()
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
})
