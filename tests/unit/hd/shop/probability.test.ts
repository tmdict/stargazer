import { describe, expect, it } from 'vitest'

import { packChance, showChance } from '@/lib/hd/shop/probability'
import type { LevelOdds } from '@/lib/hd/shop/types'

describe('shop probability', () => {
  it('a pack with repeats allowed misses only when every pick misses', () => {
    expect(packChance(1, 8, 3)).toBeCloseTo(1 - (7 / 8) ** 3)
    expect(packChance(8, 8, 3)).toBe(1)
    expect(packChance(1, 0, 3)).toBe(0)
  })

  it('a shop shows a card when any source makes it', () => {
    const sources: LevelOdds = [
      [{ good: 'hero', percent: 100 }],
      [
        { good: 'hero', percent: 50 },
        { good: 'random-pack', percent: 50 },
      ],
      [{ good: 'random-pack', percent: 100 }],
    ]
    expect(showChance(sources, (good) => (good === 'random-pack' ? 1 : 0))).toBe(1)
    // Two sources make hero cards; a card names the wanted hero one time in four.
    expect(showChance(sources, (good) => (good === 'hero' ? 1 / 4 : 0))).toBeCloseTo(
      1 - (3 / 4) * (7 / 8),
    )
  })
})
