import { describe, expect, it } from 'vitest'

import { kindRule } from '@/lib/pvp/data/kinds'
import { handOutArtifacts, nonSeasonalSet, type ArtifactClaim } from '@/lib/pvp/generator/artifacts'
import type { SlChoiceTeam } from '@/lib/pvp/generator/types'
import { madeUpData, madeUpModel } from '../fixtures/slSeason'

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
  })

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

  it('gives a team with none of its own, as one only earlier seasons recorded, the first free one in board order', () => {
    const claims = [now([], [5, 6]), now([[1, 1]], [5, 6]), now([[1, 9]], [5])]
    expect(handOutArtifacts(claims)).toEqual([5, 6, 1])
  })
})

// Artifacts 2, 3 and 5 are permanent; 7 and up are the season's.
describe('the Non-Seasonal artifact', () => {
  const team = (map: number, family: number | null, artifacts: [number, number][]) => ({
    map,
    family,
    heroes: [map * 5 + 1, map * 5 + 2, map * 5 + 3, map * 5 + 4, map * 5 + 5],
    artifacts,
    decided: 1,
  })
  const data = madeUpData(
    [
      team(0, 0, [
        [8, 40],
        [5, 6],
        [3, 2],
      ]),
      team(1, 1, [[8, 40]]),
      team(2, null, [[8, 40]]),
    ],
    madeUpModel({}),
    [
      [2, 9],
      [9, 14, 3, 2],
      [9, 14],
    ],
  )
  const chosen = (source: number): SlChoiceTeam => ({
    source,
    team: 0,
    heroes: data.maps[source]!.teams[0]!.heroes,
    family: data.maps[source]!.teams[0]!.family,
    chance: 0,
    comp: null,
    artifact: 8,
    placement: 0,
    core: [],
    flex: [],
    pairs: [],
  })

  it('is the permanent one a team was recorded with most, else the first it falls back to, else none', () => {
    const set = { chance: 0, odds: [], teams: [chosen(0), chosen(1), chosen(2)] }
    expect(nonSeasonalSet(data, set).teams.map((t) => t.artifact)).toEqual([5, 3, null])
  })
})
