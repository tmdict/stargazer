import { describe, expect, it } from 'vitest'

import { withheldHeroes } from '@/lib/pvp/data/sides'
import { madeUpModel } from '../fixtures/slSeason'

const model = madeUpModel({ heroes: { 1: [0, 1, 0, 0], 3: [0, 0, 1, 0] } })

describe('withheldHeroes', () => {
  it('holds, of heroes not listed, only those out this season or later with no model row', () => {
    const heroes = [
      { id: 1, name: 'hero1', season: 8 },
      { id: 3, name: 'hero3', season: 2 },
      { id: 4, name: 'hero4', season: 7 },
      { id: 5, name: 'hero5', season: 8 },
      { id: 6, name: 'hero6', season: 9 },
    ]
    expect(withheldHeroes(model, 8, heroes)).toEqual(new Set([5, 6]))
  })
})
