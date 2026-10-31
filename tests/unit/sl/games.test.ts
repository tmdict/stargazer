import { describe, expect, it } from 'vitest'

import { unratedHeroes, type Game, type Side } from '@/lib/pvp/sl/data/games'

const side = (heroes: number[]): Side => ({ heroes, kind: null, artifact: null })
const games: Game[] = [{ a: side([1, 2]), b: side([3]), gap: 0, aWon: true }]

describe('unratedHeroes', () => {
  it('holds only heroes out this season or later that no game fields', () => {
    const heroes = [
      { id: 1, season: 8 },
      { id: 3, season: 2 },
      { id: 4, season: 7 },
      { id: 5, season: 8 },
      { id: 6, season: 9 },
    ]
    expect(unratedHeroes(games, 8, heroes)).toEqual(new Set([5, 6]))
  })
})
