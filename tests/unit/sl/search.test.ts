import { describe, expect, it } from 'vitest'

import { lineupKey } from '@/lib/pvp/sl/data/sides'
import type { SlData, SlModel } from '@/lib/pvp/sl/data/types'
import { shortfall } from '@/lib/pvp/sl/data/upgrades'
import { artifactClaims, handOutArtifacts } from '@/lib/pvp/sl/generator/artifacts'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import type { SlFit } from '@/lib/pvp/sl/generator/fit'
import type { SlBoard } from '@/lib/pvp/sl/generator/setType'
import type { SlPick } from '@/lib/pvp/sl/generator/types'
import { sigmoid } from '@/lib/pvp/sl/model/odds'
import { readSlFile, type SlReader } from '@/lib/pvp/sl/model/reader'
import { madeUpData, madeUpModel, seededRandom, type MadeUpTeam } from '../fixtures/slSeason'

// Made-up numbers for heroes 1 to `heroes` and artifacts 1 to `artifacts`,
// where artifact 1 does most for a team, and more on group 0, so which
// artifact a team gets matters.
const randomModel = (next: () => number, heroes: number, artifacts: number): SlModel =>
  madeUpModel({
    gap: 0.01,
    fieldAgainst: { 0: next() - 0.5, 1: next() - 0.5 },
    heroes: Object.fromEntries(
      Array.from({ length: heroes }, (_, i) => [i + 1, [next() - 0.5, 1, 1, (next() - 0.5) / 5]]),
    ),
    artifacts: Object.fromEntries(
      Array.from({ length: artifacts }, (_, i) => [i + 1, [i ? (next() - 0.5) / 2 : 1.5, 1, 1]]),
    ),
    artifactsOnKind: { '1:0': [0.3, 1, 1] },
  })

const shuffled = (next: () => number, ids: number[]): number[] =>
  ids
    .map((id) => [next(), id] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, id]) => id)

// Each group's fallback list and the list for teams outside every group.
const randomFallback = (next: () => number, artifacts: number): number[][] =>
  [0, 1, 2].map(() =>
    shuffled(
      next,
      Array.from({ length: artifacts }, (_, i) => i + 1),
    ),
  )

const withGames = (next: () => number, ids: number[]): [number, number][] =>
  ids.map((id) => [id, 1 + Math.floor(next() * 5)])

// Nine teams a map, each with heroes of its map's own seven and one or two
// of six every map shares, so sets clash only there, and some with no decided
// game, which the set leaves out.
const randomSeason = (next: () => number): SlData => {
  const pick = (n: number, from: number, after: number) => {
    const ids = new Set<number>()
    while (ids.size < n) ids.add(after + 1 + Math.floor(next() * from))
    return [...ids]
  }
  const teams: MadeUpTeam[] = Array.from({ length: 45 }, (_, i) => {
    const shared = next() < 0.3 ? 2 : 1
    const family = Math.floor(next() * 3)
    return {
      map: i % 5,
      family: family === 2 ? null : family,
      heroes: [...pick(5 - shared, 7, (i % 5) * 7), ...pick(shared, 6, 35)],
      artifacts: withGames(next, pick(Math.floor(next() * 3), 7, 0)),
      decided: Math.floor(next() * 4),
    }
  })
  return madeUpData(teams, randomModel(next, 41, 7), randomFallback(next, 7))
}

const boardsOn = (data: SlData, maps: number[], recorded = true): SlBoard[] =>
  maps.map((source) => ({ key: data.maps[source]!, map: source, source, recorded }))

// The chance of winning most of the maps, over every way the maps can fall.
const winningMost = (chances: number[]): number => {
  let sum = 0
  for (let mask = 0; mask < 1 << chances.length; mask++) {
    const won = chances.filter((_, i) => mask & (1 << i)).length
    if (won > chances.length / 2) {
      sum += chances.reduce((p, c, i) => p * (mask & (1 << i) ? c : 1 - c), 1)
    }
  }
  return sum
}

// Every set of one team a map with no hero twice, the best kept, each team's
// odds scaled by its share.
const tryEvery = (
  data: SlData,
  { model }: SlReader,
  picks: SlPick[],
  share: (heroes: number[]) => number = () => 1,
): { chance: number; teams: number[] } | null => {
  const picked = new Map(picks.map((p) => [p.id, p]))
  const claimOf = artifactClaims(data)
  const pools = data.maps.map((_, map) =>
    data.teams.flatMap((t, i) =>
      t.map === map && t.heroes.every((h) => picked.has(h)) && t.decided > 0 ? [i] : [],
    ),
  )
  let best: { chance: number; teams: number[] } | null = null
  const walk = (chosen: number[]): void => {
    if (chosen.length === pools.length) {
      const heroes = chosen.flatMap((i) => data.teams[i]!.heroes)
      if (new Set(heroes).size < heroes.length) return
      const teams = chosen.map((i) => data.teams[i]!)
      const artifacts = handOutArtifacts(chosen.map((i, k) => claimOf(0, i, teams[k]!.family)))
      const chances = teams.map((t, k) => {
        const gap = -t.heroes.reduce((n, h) => n + shortfall(data.prices, picked.get(h)!), 0)
        const side = { heroes: t.heroes, kind: t.family, artifact: artifacts[k] ?? null }
        return sigmoid(model.againstTypical(side, gap) + Math.log(share(t.heroes)))
      })
      const chance = winningMost(chances)
      if (!best || chance > best.chance) best = { chance, teams: chosen }
      return
    }
    for (const i of pools[chosen.length]!) walk([...chosen, i])
  }
  walk([])
  return best
}

// Twenty-four teams on one map, four ways of splitting thirty heroes into
// six teams, so many sets of five share no hero, each team recorded with up
// to two of four artifacts, and each split stronger together than the last.
const oneMapSeason = (next: () => number): SlData => {
  const teams: MadeUpTeam[] = Array.from({ length: 4 }).flatMap(() => {
    const heroes = shuffled(
      next,
      Array.from({ length: 30 }, (_, i) => i + 1),
    )
    return Array.from({ length: 6 }, (_, k) => {
      const family = Math.floor(next() * 3)
      const artifacts = [...new Set([1 + Math.floor(next() * 4), 1 + Math.floor(next() * 4)])]
      return {
        map: 0,
        family: family === 2 ? null : family,
        heroes: heroes.slice(5 * k, 5 * k + 5),
        artifacts: withGames(next, artifacts.slice(0, Math.floor(next() * 3))),
        decided: 1 + Math.floor(next() * 3),
      }
    })
  })
  const model = randomModel(next, 30, 4)
  model.lineups = Object.fromEntries(
    teams.map((t, i) => [lineupKey(t.heroes), [Math.floor(i / 6) / 2, 1, 1]]),
  )
  return madeUpData(teams, model, randomFallback(next, 4))
}

// Every set of teams on map 0 with no hero twice, the best kept. Boards sharing
// a pool take its teams in the search's order, best chance with any artifact a
// team can end up with first, so an artifact tie goes to the better team.
const tryEveryOnOneMap = (
  data: SlData,
  { model }: SlReader,
  picks: SlPick[],
  boards: number,
): { chance: number; teams: number[] } | null => {
  const picked = new Map(picks.map((p) => [p.id, p]))
  const claimOf = artifactClaims(data)
  const claim = (i: number) => claimOf(0, i, data.teams[i]!.family)
  const chanceOf = (i: number, artifact: number | null): number => {
    const t = data.teams[i]!
    const gap = -t.heroes.reduce((n, h) => n + shortfall(data.prices, picked.get(h)!), 0)
    return sigmoid(model.againstTypical({ heroes: t.heroes, kind: t.family, artifact }, gap))
  }
  const bestOf = (i: number): number => {
    const reachable: (number | null)[] = [
      ...claim(i).own.map((o) => o.id),
      ...claim(i).fallback.slice(0, boards),
    ]
    if (reachable.length < boards) reachable.push(null)
    return Math.max(...reachable.map((a) => chanceOf(i, a)))
  }
  const pool = data.teams
    .flatMap((t, i) => (t.heroes.every((h) => picked.has(h)) && t.decided > 0 ? [i] : []))
    .sort((a, b) => bestOf(b) - bestOf(a) || data.teams[a]!.rank - data.teams[b]!.rank)
  let best: { chance: number; teams: number[] } | null = null
  const walk = (chosen: number[], from: number): void => {
    if (chosen.length === boards) {
      const artifacts = handOutArtifacts(chosen.map(claim))
      const chance = winningMost(chosen.map((i, k) => chanceOf(i, artifacts[k] ?? null)))
      if (!best || chance > best.chance) best = { chance, teams: chosen }
      return
    }
    for (let k = from; k < pool.length; k++) {
      const heroes = [...chosen, pool[k]!].flatMap((i) => data.teams[i]!.heroes)
      if (new Set(heroes).size === heroes.length) walk([...chosen, pool[k]!], k + 1)
    }
  }
  walk([], 0)
  return best
}

describe('the search', () => {
  it.each([3, 5, 8])('finds the set trying every set finds (season %i)', (seed) => {
    const next = seededRandom(seed)
    const data = randomSeason(next)
    const reader = readSlFile(data)
    for (let i = 0; i < 12; i++) {
      const picks: SlPick[] = data.order
        .filter(() => next() < 0.95)
        .map((id) => ({
          id,
          faction: 'f',
          paragon: Math.floor(next() * 5),
          refinement: Math.floor(next() * 5),
        }))
      const expected = tryEvery(data, reader, picks)
      const set = chooseSlSet(
        data,
        reader,
        picks,
        () => true,
        boardsOn(
          data,
          data.maps.map((_, i) => i),
        ),
      )
      expect(set?.teams.map((t) => t.team) ?? null).toEqual(expected?.teams ?? null)
      expect(set?.chance ?? 0).toBeCloseTo(expected?.chance ?? 0, 12)
    }
  })

  // The search measures only the teams it picks, so this checks that the set
  // it settles on is the one measuring every team gives.
  it.each([3, 5, 8])(
    'finds the set trying every set finds when every map is new (season %i)',
    (seed) => {
      const next = seededRandom(seed)
      const data = randomSeason(next)
      const reader = readSlFile(data)
      const shares = new Map(
        data.teams.map((t) => [
          lineupKey(t.heroes),
          [1, 1, 0.3, 0.1, 0.03, 0.01][Math.floor(next() * 6)]!,
        ]),
      )
      const share = (heroes: number[]): number => shares.get(lineupKey(heroes))!
      const fit: SlFit = { known: () => undefined, measure: (_, heroes) => share(heroes) }
      const borrowed = boardsOn(
        data,
        data.maps.map((_, i) => i),
        false,
      )
      for (let i = 0; i < 12; i++) {
        const picks: SlPick[] = data.order
          .filter(() => next() < 0.95)
          .map((id) => ({
            id,
            faction: 'f',
            paragon: Math.floor(next() * 5),
            refinement: Math.floor(next() * 5),
          }))
        const expected = tryEvery(data, reader, picks, share)
        const set = chooseSlSet(data, reader, picks, () => true, borrowed, fit)
        expect(set?.teams.map((t) => t.team) ?? null).toEqual(expected?.teams ?? null)
        expect(set?.chance ?? 0).toBeCloseTo(expected?.chance ?? 0, 12)
      }
    },
  )

  it.each([
    [3, 5],
    [5, 5],
    [8, 5],
    [3, 3],
    [5, 3],
    [8, 3],
  ])('finds the best set when every board is on one map (season %i, %i boards)', (seed, boards) => {
    const next = seededRandom(seed)
    const data = oneMapSeason(next)
    const reader = readSlFile(data)
    for (let i = 0; i < 8; i++) {
      const picks: SlPick[] = data.order
        .filter(() => next() < 0.9)
        .map((id) => ({
          id,
          faction: 'f',
          paragon: Math.floor(next() * 5),
          refinement: Math.floor(next() * 5),
        }))
      const expected = tryEveryOnOneMap(data, reader, picks, boards)
      const set = chooseSlSet(
        data,
        reader,
        picks,
        () => true,
        boardsOn(data, Array<number>(boards).fill(0)),
      )
      expect(set?.teams.map((t) => t.team) ?? null).toEqual(expected?.teams ?? null)
      expect(set?.chance ?? 0).toBeCloseTo(expected?.chance ?? 0, 12)
    }
  })
})
