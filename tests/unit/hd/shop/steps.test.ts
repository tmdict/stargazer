import { describe, expect, it } from 'vitest'

import { moveSteps, stopSteps } from '@/components/guide/shop/shopGoods'
import type { ShopCard } from '@/lib/hd/shop/types'

const card = (good: string | null, locked = false, bought = false): ShopCard => ({
  good,
  locked,
  bought,
})

// Card 1 is locked, and card 3 was locked before it was bought.
const cards = [
  card('hero'),
  card('mauler-pack', true),
  card('random-pack'),
  card('hero', true, true),
]

describe('the steps a move reads as', () => {
  it('a reroll names each lock lifted, kept and set, then the reroll', () => {
    expect(moveSteps({ kind: 'reroll', locks: [0, 1] }, cards)).toEqual([
      { kind: 'keep', card: 1 },
      { kind: 'lock', card: 0 },
      { kind: 'reroll', price: 3 },
    ])
    expect(moveSteps({ kind: 'reroll', locks: [2] }, cards)).toEqual([
      { kind: 'unlock', card: 1 },
      { kind: 'lock', card: 2 },
      { kind: 'reroll', price: 3 },
    ])
  })

  it('a purchase is one step at the card price', () => {
    expect(moveSteps({ kind: 'buy', card: 1 }, cards)).toEqual([
      { kind: 'buy', card: 1, price: 33 },
    ])
  })

  it('stopping buys first and never locks the card it bought', () => {
    expect(stopSteps({ locks: [0, 1], buy: 0 }, cards)).toEqual([
      { kind: 'buy', card: 0, price: 15 },
      { kind: 'keep', card: 1 },
      { kind: 'wait' },
    ])
  })
})
