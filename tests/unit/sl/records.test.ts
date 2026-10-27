import { describe, expect, it } from 'vitest'

import type { Game, Side } from '@/lib/pvp/sl/data/games'
import { seasonRecords } from '@/lib/pvp/sl/data/records'

// Hero 5 plays for both x and z, and z is outside every kind of team.
const x: Side = { heroes: [1, 2, 3, 4, 5], kind: 0, artifact: 7 }
const y: Side = { heroes: [10, 9, 8, 7, 6], kind: 1, artifact: null }
const z: Side = { heroes: [14, 13, 12, 11, 5], kind: null, artifact: 7 }

const games: Game[] = [
  { a: x, b: y, gap: 0, aWon: true },
  { a: { ...y, heroes: [6, 7, 8, 9, 10] }, b: x, gap: 0, aWon: false },
  { a: x, b: z, gap: 0, aWon: false },
]

describe('seasonRecords', () => {
  const records = seasonRecords(games)

  it('counts each side of a game on its own', () => {
    expect(records.hero(1)).toEqual({ wins: 2, losses: 1 })
    expect(records.hero(5)).toEqual({ wins: 3, losses: 1 })
    expect(records.artifact(7)).toEqual({ wins: 3, losses: 1 })
    expect(records.hero(99)).toEqual({ wins: 0, losses: 0 })
  })

  it('counts against and on a kind only when that team has one', () => {
    expect(records.heroAgainst(1, 1)).toEqual({ wins: 2, losses: 0 })
    expect(records.heroAgainst(6, 0)).toEqual({ wins: 0, losses: 2 })
    expect(records.heroAgainst(11, 0)).toEqual({ wins: 1, losses: 0 })
    expect(records.artifactOn(7, 0)).toEqual({ wins: 2, losses: 1 })
  })

  it('finds a lineup in any order', () => {
    expect(records.lineup([5, 4, 3, 2, 1])).toEqual({ wins: 2, losses: 1 })
    expect(records.headToHead([3, 1, 2, 5, 4], y.heroes)).toEqual({ wins: 2, losses: 0 })
    expect(records.headToHead([6, 7, 8, 9, 10], x.heroes)).toEqual({ wins: 0, losses: 2 })
  })
})
