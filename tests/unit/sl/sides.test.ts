import { describe, expect, it } from 'vitest'

import { unratedHeroes } from '@/lib/pvp/data/sides'
import { madeUpModel } from '../fixtures/slSeason'

const model = madeUpModel({ heroes: { 1: [0, 1, 0, 0], 3: [0, 0, 1, 0] } })

describe('unratedHeroes', () => {
  it('holds only heroes out this season or later that the model has no row for', () => {
    const heroes = [
      { id: 1, season: 8 },
      { id: 3, season: 2 },
      { id: 4, season: 7 },
      { id: 5, season: 8 },
      { id: 6, season: 9 },
    ]
    expect(unratedHeroes(model, 8, heroes)).toEqual(new Set([5, 6]))
  })
})
