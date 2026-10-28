import { describe, expect, it } from 'vitest'

import { kindRule } from '@/lib/pvp/sl/data/kinds'
import type { SlGame } from '@/lib/pvp/sl/data/types'
import {
  artifactClaims,
  handOutArtifacts,
  type ArtifactClaim,
} from '@/lib/pvp/sl/generator/artifacts'
import { placementOf } from '@/lib/pvp/sl/generator/boards'
import { learnSeason } from '@/lib/pvp/sl/model/models'
import { madeUpData, type MadeUpTeam } from '../fixtures/slSeason'

describe('a team’s kind', () => {
  const kindOf = kindRule([
    { heroes: [1, 2, 3, 4, 5], family: 0 },
    { heroes: [1, 2, 3, 6, 7], family: 1 },
    { heroes: [1, 2, 3, 8, 9], family: 1 },
    { heroes: [10, 11, 12, 13, 14], family: null },
    { heroes: [10, 11, 12, 15, 16], family: 0 },
    { heroes: [20, 21, 22, 23, 24], family: 2 },
    { heroes: [20, 21, 22, 25, 26], family: 1 },
  ])

  it('is a recorded team’s own group, whatever its heroes’ order', () => {
    expect(kindOf([5, 4, 3, 2, 1])).toBe(0)
  })

  it('goes to the group with the most votes among the teams sharing the most heroes', () => {
    expect(kindOf([1, 2, 3, 30, 31])).toBe(1)
    expect(kindOf([1, 2, 3, 4, 30])).toBe(0)
  })

  it('goes to the group listed first on a tie', () => {
    expect(kindOf([20, 21, 22, 30, 31])).toBe(1)
  })

  it('is outside every group when only a team outside every group shares the most', () => {
    expect(kindOf([10, 11, 12, 13, 30])).toBeNull()
  })

  it('is outside every group when no team shares three heroes', () => {
    expect(kindOf([1, 2, 30, 31, 32])).toBeNull()
  })
})

describe('the artifact rule', () => {
  const now = (own: [id: number, games: number][], fallback: number[] = []): ArtifactClaim => ({
    own: own.map(([id, games]) => ({ id, games })),
    fallback,
    before: false,
  })
  const before = (like: number[]): ArtifactClaim => ({ own: [], fallback: like, before: true })

  it('keeps the way that gives out the artifacts with the most games', () => {
    expect(
      handOutArtifacts([
        now([
          [1, 6],
          [2, 5],
        ]),
        now([[1, 4]]),
      ]),
    ).toEqual([2, 1])
  })

  it('leaves an artifact with the team on the earlier board when two ways tie', () => {
    expect(handOutArtifacts([now([[1, 5]]), now([[1, 5]], [3])])).toEqual([1, 3])
  })

  it('gives a team left without one the first free artifact it falls back to', () => {
    const claims = [now([[1, 5]], [2, 3]), now([[1, 2]], [4, 3]), now([[4, 1]], [2])]
    expect(handOutArtifacts(claims)).toEqual([1, 3, 4])
  })

  it('gives last season’s teams the first free artifact they like, after this season’s', () => {
    const claims = [before([5, 6]), now([[1, 1]], [5, 6]), now([[1, 9]], [5])]
    expect(handOutArtifacts(claims)).toEqual([6, 5, 1])
  })

  it('falls back to what the team’s kind played most, then the season, then the lower id', () => {
    const data = madeUpData(
      [
        { map: 0, family: 0, heroes: [1, 2, 3, 4, 5], artifacts: [4] },
        { map: 0, family: 1, heroes: [6, 7, 8, 9, 10], artifacts: [1] },
        { map: 0, family: null, heroes: [11, 12, 13, 14, 15], artifacts: [] },
      ],
      [
        [0, 'w', 0, 3],
        [1, 'l', 0, 1],
        [0, 'l', 0, 3],
        [1, 'w', 0, 1],
        [0, 'w', 0, 4],
        [1, 'l', 0, 1],
        [2, 'w', 0, null],
        [1, 'l', 0, 1],
        [2, 'l', 0, null],
        [1, 'w', 0, 2],
      ],
    )
    const claimOf = artifactClaims(data)
    expect(claimOf(0, 0, 0)).toEqual({
      own: [{ id: 4, games: 1 }],
      fallback: [3, 1, 2],
      before: false,
    })
    expect(claimOf(0, 2, null).fallback).toEqual([1, 3, 2, 4])
  })
})

describe('a team’s board', () => {
  // Artifact 1 wins most of the games it meets artifact 2 in. Team 0 went 5–1
  // with artifact 1 on its first placement and 4–2 with artifact 2 on its
  // second, so the second did better than its artifact predicts.
  const season = () => {
    const teams: MadeUpTeam[] = Array.from({ length: 10 }, (_, i) => ({
      map: 0,
      family: null,
      heroes: [1, 2, 3, 4, 5].map((h) => 5 * i + h),
      artifacts: [1, 2],
    }))
    const games: SlGame[] = []
    for (let k = 0; k < 200; k++) {
      const [a, b] = [1 + (k % 9), 1 + ((k + 1 + (k % 8)) % 9)]
      const won = k % 10 < 8
      games.push([a, won ? 'w' : 'l', 0, 1], [b, won ? 'l' : 'w', 0, 2])
    }
    const placed = (artifact: number, results: string): number[] =>
      [...results].map((r, k) => {
        games.push([0, r === 'w' ? 'w' : 'l', 0, artifact], [1 + k, r === 'w' ? 'l' : 'w', 0, null])
        return games.length - 2
      })
    const strong = placed(1, 'wwwwwl')
    const weak = placed(2, 'wwwwll')
    const data = madeUpData(teams, games)
    data.teams[0]!.placements = [strong, weak].map((ids, order) => ({
      games: ids,
      use: 1,
      players: 1,
      setups: 1,
      agree: 1,
      order,
      c: [],
      s: [],
    }))
    return data
  }

  it('gives a placement nothing for games won on a stronger artifact', () => {
    const data = season()
    const learned = learnSeason(data)
    expect(placementOf(data, learned, 0, 0, 1)).toBe(1)
    expect(placementOf(data, learned, 0, 0, null)).toBe(1)
  })
})
