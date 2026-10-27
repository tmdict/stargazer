import { describe, expect, it } from 'vitest'

import type { SlData, SlGame } from '@/lib/pvp/sl/data/types'
import { shortfall } from '@/lib/pvp/sl/data/upgrades'
import { artifactClaims, handOutArtifacts } from '@/lib/pvp/sl/generator/artifacts'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import type { SlPick } from '@/lib/pvp/sl/generator/types'
import { sigmoid } from '@/lib/pvp/sl/model/fit'
import { learnSeason, type SlLearned } from '@/lib/pvp/sl/model/models'
import { madeUpData, seededRandom, type MadeUpTeam } from '../fixtures/slSeason'

// Nine teams a map, each with heroes of its map's own seven and one or two
// of six every map shares, so sets clash only there, and 200 games between
// teams on the same map, where artifact 1 helps a side win, so which
// artifact a team gets matters.
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
      artifacts: pick(Math.floor(next() * 3), 7, 0).map((id): [number, number] => [id, 0.5]),
    }
  })
  const games: SlGame[] = []
  for (let k = 0; k < 200; k++) {
    const a = Math.floor(next() * teams.length)
    const b = 5 * Math.floor(next() * 9) + (a % 5)
    const gap = Math.round((next() - 0.5) * 200)
    const artifact = (team: number) => {
      const own = teams[team]!.artifacts
      return own.length ? own[Math.floor(next() * own.length)]![0] : null
    }
    const [x, y] = [artifact(a), artifact(b)]
    const won = next() < sigmoid((x === 1 ? 1.5 : 0) - (y === 1 ? 1.5 : 0) + gap / 100)
    games.push([a, won ? 'w' : 'l', gap, x], [b, won ? 'l' : 'w', -gap, y])
  }
  return madeUpData(teams, games)
}

// The chance of winning at least three of five maps, over every way the maps
// can fall.
const atLeastThree = (chances: number[]): number => {
  let sum = 0
  for (let mask = 0; mask < 32; mask++) {
    const won = chances.filter((_, i) => mask & (1 << i)).length
    if (won >= 3) sum += chances.reduce((p, c, i) => p * (mask & (1 << i) ? c : 1 - c), 1)
  }
  return sum
}

// Every set of one team a map with no hero twice, the best kept.
const tryEvery = (
  data: SlData,
  { model }: SlLearned,
  picks: SlPick[],
): { chance: number; teams: number[] } | null => {
  const picked = new Map(picks.map((p) => [p.id, p]))
  const claimOf = artifactClaims(data)
  const pools = data.maps.map((_, map) =>
    data.teams.flatMap((t, i) =>
      t.map === map &&
      t.heroes.every((h) => picked.has(h)) &&
      t.games.some((k) => data.games[k]![1] !== 't')
        ? [i]
        : [],
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
        return sigmoid(model.againstTypical(side, gap))
      })
      const chance = atLeastThree(chances)
      if (!best || chance > best.chance) best = { chance, teams: chosen }
      return
    }
    for (const i of pools[chosen.length]!) walk([...chosen, i])
  }
  walk([])
  return best
}

describe('the search', () => {
  it.each([3, 5, 8])('finds the set trying every set finds (season %i)', (seed) => {
    const next = seededRandom(seed)
    const data = randomSeason(next)
    const learned = learnSeason(data)
    for (let i = 0; i < 12; i++) {
      const picks: SlPick[] = data.order
        .filter(() => next() < 0.95)
        .map((id) => ({
          id,
          faction: 'f',
          paragon: Math.floor(next() * 5),
          refinement: Math.floor(next() * 5),
        }))
      const expected = tryEvery(data, learned, picks)
      const set = chooseSlSet(data, learned, picks)
      expect(set?.teams.map((t) => t.team) ?? null).toEqual(expected?.teams ?? null)
      expect(set?.chance ?? 0).toBeCloseTo(expected?.chance ?? 0, 12)
    }
  })
})
