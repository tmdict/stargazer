import { describe, expect, it } from 'vitest'

import type { MapLayout } from '@/lib/maps'
import { lineupKey } from '@/lib/pvp/data/sides'
import type { SlData, SlModel, SlTeam } from '@/lib/pvp/data/types'
import { shortfall } from '@/lib/pvp/data/upgrades'
import { artifactClaims, handOutArtifacts } from '@/lib/pvp/generator/artifacts'
import { chooseSlSet } from '@/lib/pvp/generator/chooser'
import { slFit, type SlFit } from '@/lib/pvp/generator/fit'
import type { SlBoard } from '@/lib/pvp/generator/setType'
import type { SlPick } from '@/lib/pvp/generator/types'
import { sigmoid } from '@/lib/pvp/model/odds'
import { readSlFile, type SlReader } from '@/lib/pvp/model/reader'
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
// game, which the set leaves out. With no rows over every map, a board takes
// only its own map's teams.
const randomSeason = (next: () => number, everyMap = false): SlData => {
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
  const data = madeUpData(teams, randomModel(next, 41, 7), randomFallback(next, 7))
  return everyMap ? data : { ...data, everyMap: [] }
}

// The made-up maps have no tiles, so a search on them lets every team stand there.
const layoutOf = (key: string): MapLayout => ({
  key,
  config: { id: 0, name: '', grid: [] },
  buffTiles: [],
})

const boardsOn = (data: SlData, maps: number[]): SlBoard[] =>
  maps.map((source) => ({ layout: layoutOf(data.maps[source]!.key), map: source, source }))
const standing = (data: SlData): SlFit => ({ ...slFit(data), stands: () => true })

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
  const pools = data.maps.map((m) =>
    m.teams.flatMap((t, i) => (t.heroes.every((h) => picked.has(h)) && t.decided > 0 ? [i] : [])),
  )
  let best: { chance: number; teams: number[] } | null = null
  const walk = (chosen: number[]): void => {
    if (chosen.length === pools.length) {
      const teams = chosen.map((i, map) => data.maps[map]!.teams[i]!)
      const heroes = teams.flatMap((t) => t.heroes)
      if (new Set(heroes).size < heroes.length) return
      const artifacts = handOutArtifacts(teams.map(claimOf))
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
  const list = data.maps[0]!.teams
  const claim = (i: number) => artifactClaims(data)(list[i]!)
  const chanceOf = (i: number, artifact: number | null): number => {
    const t = list[i]!
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
  const pool = list
    .flatMap((t, i) => (t.heroes.every((h) => picked.has(h)) && t.decided > 0 ? [i] : []))
    .sort((a, b) => bestOf(b) - bestOf(a) || list[a]!.rank - list[b]!.rank)
  let best: { chance: number; teams: number[] } | null = null
  const walk = (chosen: number[], from: number): void => {
    if (chosen.length === boards) {
      const artifacts = handOutArtifacts(chosen.map(claim))
      const chance = winningMost(chosen.map((i, k) => chanceOf(i, artifacts[k] ?? null)))
      if (!best || chance > best.chance) best = { chance, teams: chosen }
      return
    }
    for (let k = from; k < pool.length; k++) {
      const heroes = [...chosen, pool[k]!].flatMap((i) => list[i]!.heroes)
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
        standing(data),
      )
      expect(set?.teams.map((t) => t.team) ?? null).toEqual(expected?.teams ?? null)
      expect(set?.chance ?? 0).toBeCloseTo(expected?.chance ?? 0, 12)
    }
  })

  // The search measures only the teams it picks, so this checks that the set
  // it settles on is the one measuring every team gives.
  it.each([3, 5, 8])(
    'finds the set trying every set finds when no fit is known yet (season %i)',
    (seed) => {
      const next = seededRandom(seed)
      const data = randomSeason(next)
      const reader = readSlFile(data)
      const shares = new Map(
        data.maps
          .flatMap((m) => m.teams)
          .map((t) => [lineupKey(t.heroes), [1, 1, 0.3, 0.1, 0.03, 0.01][Math.floor(next() * 6)]!]),
      )
      const share = (heroes: number[]): number => shares.get(lineupKey(heroes))!
      const fit: SlFit = {
        stands: () => true,
        known: () => undefined,
        measure: (_, heroes) => share(heroes),
      }
      const boards = boardsOn(
        data,
        data.maps.map((_, i) => i),
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
        const set = chooseSlSet(data, reader, picks, () => true, boards, fit)
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
        standing(data),
      )
      expect(set?.teams.map((t) => t.team) ?? null).toEqual(expected?.teams ?? null)
      expect(set?.chance ?? 0).toBeCloseTo(expected?.chance ?? 0, 12)
    }
  })

  // Each lineup's row adds up its games on every map, so it can meet a
  // minimum its record on any one map would miss.
  it('takes each lineup’s record over every map on a map with no records, its fit measured from its home', () => {
    const next = seededRandom(1)
    const lineup = (map: number, heroes: number[], decided: number): MadeUpTeam => ({
      map,
      family: 0,
      heroes,
      artifacts: [],
      decided,
    })
    const data = madeUpData(
      [
        lineup(0, [1, 2, 3, 4, 5], 2),
        lineup(1, [5, 4, 3, 2, 1], 3),
        lineup(2, [6, 7, 8, 9, 10], 3),
      ],
      randomModel(next, 10, 1),
      randomFallback(next, 1),
    )
    data.evidence = [{ groupGames: 0, players: 0, games: 4, oneOffs: true }]
    const picks: SlPick[] = [1, 2, 3, 4, 5].map((id) => ({
      id,
      faction: 'f',
      paragon: 4,
      refinement: 4,
    }))
    const board: SlBoard = { layout: layoutOf('new'), map: 0, source: null }
    const fit: SlFit = {
      stands: () => true,
      known: () => undefined,
      measure: (_, __, from) => (from === 1 ? 0.5 : 1),
    }
    const reader = readSlFile(data)
    const set = chooseSlSet(data, reader, picks, () => true, [board], fit)
    expect(set?.teams.map((t) => [t.source, t.team])).toEqual([[null, 0]])
    const side = { heroes: [1, 2, 3, 4, 5], kind: 0, artifact: 1 }
    expect(set!.chance).toBeCloseTo(
      sigmoid(reader.model.againstTypical(side, 0) + Math.log(0.5)),
      12,
    )
  })

  it('gives a board whose map’s teams the selection leaves none of the rows of every map, and keeps the others on their own', () => {
    const next = seededRandom(2)
    const team = (map: number, heroes: number[]): MadeUpTeam => ({
      map,
      family: null,
      heroes,
      artifacts: [],
      decided: 1,
    })
    const data = madeUpData(
      [team(0, [1, 2, 3, 4, 5]), team(1, [6, 7, 8, 9, 10]), team(2, [11, 12, 13, 14, 15])],
      randomModel(next, 15, 1),
      randomFallback(next, 1),
    )
    const picks: SlPick[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15].map((id) => ({
      id,
      faction: 'f',
      paragon: 4,
      refinement: 4,
    }))
    const fit: SlFit = { stands: () => true, known: () => 1, measure: () => 1 }
    const set = chooseSlSet(data, readSlFile(data), picks, () => true, boardsOn(data, [0, 1]), fit)
    expect(set?.teams.map((t) => [t.source, t.heroes])).toEqual([
      [0, [1, 2, 3, 4, 5]],
      [null, [11, 12, 13, 14, 15]],
    ])
  })

  it('gives every board the rows of every map when the maps’ own teams clash', () => {
    const next = seededRandom(3)
    const team = (map: number, heroes: number[]): MadeUpTeam => ({
      map,
      family: null,
      heroes,
      artifacts: [],
      decided: 1,
    })
    const data = madeUpData(
      [team(0, [1, 2, 3, 4, 5]), team(1, [1, 6, 7, 8, 9]), team(2, [11, 12, 13, 14, 15])],
      randomModel(next, 15, 1),
      randomFallback(next, 1),
    )
    const picks: SlPick[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15].map((id) => ({
      id,
      faction: 'f',
      paragon: 4,
      refinement: 4,
    }))
    const fit: SlFit = { stands: () => true, known: () => 1, measure: () => 1 }
    const set = chooseSlSet(data, readSlFile(data), picks, () => true, boardsOn(data, [0, 1]), fit)
    expect(set?.teams.every((t) => t.source === null)).toBe(true)
    expect(set?.teams.flatMap((t) => t.heroes).includes(11)).toBe(true)
  })

  // Every map's teams share one pool there, so this checks that the teams a
  // set settles on and the boards they trade to are the best of every way of
  // standing them, where a team's fit and whether it stands differ by map.
  it.each([3, 5, 8])(
    'finds the best set trying every set finds on maps with no records (season %i)',
    (seed) => {
      const next = seededRandom(seed)
      const season = randomSeason(next, true)
      // With no artifact to hand out, which board a team stands on changes only
      // its fit.
      const data: SlData = {
        ...season,
        everyMap: season.everyMap.map((t) => ({ ...t, artifacts: [] })),
        fallback: [[], [], []],
      }
      const reader = readSlFile(data)
      const layouts = ['new-0', 'new-1', 'new-2']
      const fits = new Map(
        data.everyMap.flatMap((t) =>
          layouts.map((layout) => [
            `${layout}|${lineupKey(t.heroes)}`,
            next() < 0.15 ? null : [1, 1, 0.3, 0.1, 0.03][Math.floor(next() * 5)]!,
          ]),
        ),
      )
      const fitOf = (layout: string, heroes: number[]) =>
        fits.get(`${layout}|${lineupKey(heroes)}`)!
      const fit: SlFit = {
        stands: (board, heroes) => fitOf(board.layout.key, heroes) !== null,
        known: () => undefined,
        measure: (board, heroes) => fitOf(board.layout.key, heroes)!,
      }
      const boards = layouts.map((key, map) => ({ layout: layoutOf(key), map, source: null }))
      for (let i = 0; i < 12; i++) {
        const picks: SlPick[] = data.order
          .filter(() => next() < 0.95)
          .map((id) => ({
            id,
            faction: 'f',
            paragon: Math.floor(next() * 5),
            refinement: Math.floor(next() * 5),
          }))
        const picked = new Map(picks.map((p) => [p.id, p]))
        const teams = data.everyMap.filter(
          (t) => t.decided > 0 && t.heroes.every((h) => picked.has(h)),
        )
        const chanceOf = (t: SlTeam, layout: string): number | null => {
          const share = fitOf(layout, t.heroes)
          if (share === null) return null
          const gap = -t.heroes.reduce((n, h) => n + shortfall(data.prices, picked.get(h)!), 0)
          const side = { heroes: t.heroes, kind: t.family, artifact: null }
          return sigmoid(reader.model.againstTypical(side, gap) + Math.log(share))
        }
        let expected = 0
        for (const a of teams) {
          for (const b of teams) {
            for (const c of teams) {
              const heroes = [...a.heroes, ...b.heroes, ...c.heroes]
              if (new Set(heroes).size < heroes.length) continue
              const chances = [a, b, c].map((t, k) => chanceOf(t, layouts[k]!))
              if (chances.some((chance) => chance === null)) continue
              expected = Math.max(expected, winningMost(chances as number[]))
            }
          }
        }
        const set = chooseSlSet(data, reader, picks, () => true, boards, fit)
        expect(set?.chance ?? 0).toBeCloseTo(expected, 12)
        set?.teams.forEach((t, k) => expect(fitOf(layouts[k]!, t.heroes)).not.toBeNull())
      }
    },
  )
})
