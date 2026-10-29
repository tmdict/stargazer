import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { companionIdsOf } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { loadSlData } from '@/lib/pvp/sl/data/codec'
import type { SlBefore, SlData, SlUnit } from '@/lib/pvp/sl/data/types'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import type { SlChoice, SlPick } from '@/lib/pvp/sl/generator/types'
import { learnSeason } from '@/lib/pvp/sl/model/models'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { loadArtifacts, loadCharacters, loadPhantimals } from '@/utils/dataLoader'

// The file a deploy ships, as copied in from the external report generator.
// The page fetches the file the build emits, so the test serves it the same
// bytes.
vi.stubGlobal(
  'fetch',
  async () =>
    new Response(readFileSync(new URL('../../../src/content/pvp/sl/sl.bin', import.meta.url))),
)
const data = await loadSlData()
vi.unstubAllGlobals()
const seasons = [data, ...(data.before ? [data.before] : [])]
const learned = learnSeason(data)
const heroes = new Map(
  loadCharacters()
    .filter((c) => !c.placeholder)
    .map((c) => [c.id, c]),
)
const pick = (id: number, paragon = 4, refinement = 4): SlPick => ({
  id,
  faction: heroes.get(id)!.faction,
  paragon,
  refinement,
})
const named = [...new Set(seasons.flatMap((s) => s.teams.flatMap((t) => t.heroes)))]
const RARE = ['celestial', 'hypogean']

// Whether the selected heroes' teams in `from`, each with a decided game, fill
// every map with no hero twice: the generator makes a set exactly then.
function fills(
  picked: ReadonlySet<number>,
  from: readonly (SlData | SlBefore)[] = seasons,
): boolean {
  const pools = data.maps.map((_, map) => {
    const pool: number[][] = []
    for (const s of from)
      for (const t of s.teams)
        if (
          t.map === map &&
          t.heroes.every((id) => picked.has(id)) &&
          t.games.some((i) => s.games[i]![1] !== 't')
        )
          pool.push(t.heroes)
    return pool
  })
  const fill = (map: number, used: ReadonlySet<number>): boolean =>
    map === pools.length ||
    pools[map]!.some(
      (team) => !team.some((id) => used.has(id)) && fill(map + 1, new Set([...used, ...team])),
    )
  return fill(0, new Set())
}

// The generator's rules for the set it chose for `picks`.
function holds(picks: SlPick[], chosen = chooseSlSet(data, learned, picks)): SlChoice {
  expect(chosen).not.toBeNull()
  const set = chosen!
  expect(set.teams).toHaveLength(data.maps.length)
  const used = set.teams.flatMap((t) => t.heroes)
  expect(new Set(used).size).toBe(used.length)
  const selected = new Set(picks.map((p) => p.id))
  expect(used.every((id) => selected.has(id))).toBe(true)
  const free = new Set([...selected].filter((id) => !used.includes(id)))
  set.teams.forEach((t, map) => {
    const team = (t.source === 0 ? data : data.before!).teams[t.team]!
    expect(team.map).toBe(map)
    expect(t.heroes).toEqual(team.heroes)
    expect(t.artifact).not.toBeNull()
    // Each of last season's teams takes an artifact from its own list.
    if ('like' in team) expect(team.like).toContain(t.artifact)
    expect(t.chance).toBeGreaterThan(0)
    expect(t.chance).toBeLessThan(1)
    expect(t.placement).toBeGreaterThanOrEqual(0)
    expect(t.placement).toBeLessThan(team.placements.length)
    expect(
      t.flex.every((f) => t.heroes.includes(f.out) && f.options.every((id) => free.has(id))),
    ).toBe(true)
    // Every one-hero swap of a group core hero is shown, past the limit if need
    // be, and the other one-hero swaps and then the two-hero swaps fill the rows
    // it leaves. A two-hero swap takes heroes the set leaves free, for two of the
    // team's that are neither core nor out in a one-hero swap.
    const season = t.source === 0 ? data : data.before!
    const groupCore = t.family === null ? [] : season.families[t.family]!.core
    const moved = t.flex.filter((f) => groupCore.includes(f.out)).length
    expect(t.flex.length - moved).toBeLessThanOrEqual(Math.max(0, data.flex.heroes - moved))
    expect(t.pairs.length).toBeLessThanOrEqual(Math.max(0, data.flex.heroes - t.flex.length))
    const fixed = new Set([...t.core, ...t.flex.map((f) => f.out)])
    for (const pair of t.pairs) {
      expect(pair.out.every((id) => t.heroes.includes(id) && !fixed.has(id))).toBe(true)
      expect(pair.options.flat().every((id) => free.has(id))).toBe(true)
    }
  })
  expect(new Set(set.teams.map((t) => t.artifact)).size).toBe(set.teams.length)
  expect(set.chance).toBeGreaterThan(0)
  expect(set.chance).toBeLessThan(1)
  // The chances of winning each number of boards add up to 1, and those of
  // winning most of them to the set's chance.
  const sum = (odds: number[]) => odds.reduce((a, b) => a + b, 0)
  expect(Math.abs(sum(set.odds) - 1)).toBeLessThan(1e-12)
  expect(
    Math.abs(sum(set.odds.slice(Math.floor(data.maps.length / 2) + 1)) - set.chance),
  ).toBeLessThan(1e-12)
  return set
}

describe('the shipped Supreme League data', () => {
  // A rotation must not hold up a deploy, so the maps are the file's own.
  it('names only heroes Stargazer knows, and companions their heroes spawn', () => {
    expect(data.order.filter((id) => !heroes.has(id))).toEqual([])
    const strays: SlUnit[] = []
    for (const s of seasons) {
      for (const t of s.teams) {
        expect(t.heroes.every((id) => heroes.has(id))).toBe(true)
        for (const p of t.placements) {
          const units = p.c.map(([, id]) => id)
          const spawned = new Set(units.flatMap((id) => companionIdsOf(id)))
          strays.push(...p.c.filter(([, id]) => !t.heroes.includes(id) && !spawned.has(id)))
          const [phantimal, ...companions] = p.s
          const own = new Set(phantimal ? companionIdsOf(toPhantimalId(phantimal[1])) : [])
          strays.push(...companions.filter(([, id]) => !own.has(toPhantimalId(id))))
        }
      }
    }
    expect(strays).toEqual([])
  })

  // Both pages find a game's opponent this way.
  it('holds each game as two consecutive entries, the first at an even index', () => {
    const opposite = { w: 'l', l: 'w', t: 't' }
    for (const s of seasons) {
      expect(s.games.length % 2).toBe(0)
      for (let i = 0; i < s.games.length; i += 2) {
        const [a, resultA, gapA] = s.games[i]!
        const [b, resultB, gapB] = s.games[i + 1]!
        expect(s.teams[a]!.map).toBe(s.teams[b]!.map)
        expect(resultB).toBe(opposite[resultA])
        expect(gapA + gapB).toBe(0)
      }
    }
  })

  // The set hands each of last season's teams the first artifact on its list
  // that the other four leave free.
  it.runIf(!!data.before)('lists an artifact for every map on each of last season’s teams', () => {
    expect(data.before!.teams.filter((t) => t.like.length < data.maps.length)).toEqual([])
  })

  // After a cutover the ids name the new season's content, so they are only
  // checked while the file's season is Stargazer's.
  it.runIf(data.season === CURRENT_SEASON)('uses the season’s own artifacts and phantimals', () => {
    const artifacts = new Set(loadArtifacts().map((a) => a.id))
    const phantimals = new Set(loadPhantimals().map((p) => p.id))
    for (const s of seasons) {
      for (const t of s.teams) {
        const ids = 'artifacts' in t ? t.artifacts : t.like
        expect(ids.filter((id) => !artifacts.has(id))).toEqual([])
        const used = t.placements.flatMap((p) => (p.s[0] ? [p.s[0][1]] : []))
        expect(used.filter((id) => !phantimals.has(id))).toEqual([])
      }
    }
    const played = data.games.flatMap(([, , , id]) => (id === null ? [] : [id]))
    expect(played.filter((id) => !artifacts.has(id))).toEqual([])
  })
})

describe('chooseSlSet on the shipped data', () => {
  it('makes a set of every recorded hero at the top levels', () => {
    const picks = named.map((id) => pick(id))
    const set = chooseSlSet(data, learned, picks)
    expect(set).not.toBeNull()
    holds(picks, set)
  })

  // Early in a season this season's teams fill no set yet, and the season
  // before's join them.
  const rare = named.filter((id) => RARE.includes(heroes.get(id)!.faction)).length
  it.runIf(rare >= (data.beforeUnder ?? 0) && fills(new Set(named), [data]))(
    'takes that set from this season alone once its teams fill every map',
    () => {
      const set = holds(named.map((id) => pick(id)))
      expect(set.teams.every((t) => t.source === 0)).toBe(true)
    },
  )

  it('counts upgrades against a team', () => {
    const full = holds(named.map((id) => pick(id)))
    const low = holds(named.map((id) => pick(id, 0, 0)))
    expect(low.chance).toBeLessThanOrEqual(full.chance)
  })

  it('makes no set from no heroes', () => {
    expect(chooseSlSet(data, learned, [])).toBeNull()
  })
})

// Seeded and random selections, the same on every run: few Celestial and
// Hypogean heroes, which the season before's teams join, partial ones this
// season's teams alone cannot fill, near-full ones, some again with Celestial
// and Hypogean heroes no recorded team holds, each hero at random levels, and
// every hero at P4 R4.
describe('chooseSlSet on 626 seeded selections', () => {
  let seed = 20261024
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
  const level = () => Math.floor(random() * 5)
  const roster = [...heroes.values()]
  const held = new Set(named)
  const under = data.beforeUnder ?? 0
  const pickOf = (h: { id: number; faction: string }, top: boolean): SlPick => ({
    id: h.id,
    faction: h.faction,
    paragon: top ? 4 : level(),
    refinement: top ? 4 : level(),
  })
  // Celestial and Hypogean heroes no team holds, as a newly released one is:
  // those Stargazer knows, and stand-ins under ids no hero has, enough to pass
  // the threshold if they were counted.
  const spare = Math.max(...heroes.keys()) + 1
  const unrecorded = [
    ...roster.filter((h) => RARE.includes(h.faction) && !held.has(h.id)),
    ...Array.from({ length: under }, (_, i) => ({ id: spare + i, faction: RARE[i % 2]! })),
  ]
  // How many recorded Celestial and Hypogean heroes a kind of selection takes,
  // and what share of the rest.
  const recordedRare = roster.filter((h) => RARE.includes(h.faction) && held.has(h.id))
  const kinds: [string, () => number, () => number][] = [
    [
      'few Celestial and Hypogean heroes',
      () => Math.round(recordedRare.length * 0.1),
      () => 0.6 + random() * 0.35,
    ],
    [
      'one Celestial or Hypogean hero under the threshold',
      () => under - 1,
      () => 0.6 + random() * 0.35,
    ],
    ['Celestial and Hypogean heroes at the threshold', () => under, () => 0.6 + random() * 0.35],
    [
      'a part of the heroes',
      () => Math.round(recordedRare.length * (0.2 + random() * 0.3)),
      () => 0.2 + random() * 0.3,
    ],
    ['nearly every hero', () => recordedRare.length, () => 0.85 + random() * 0.15],
  ]
  const shuffled = <T>(list: T[]) =>
    list
      .map((x) => [random(), x] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, x]) => x)
  interface Selection {
    kind: string
    picks: SlPick[]
    // The selection without the heroes no team holds, whose answer must be the same.
    same?: number
  }
  const selections: Selection[] = [
    { kind: 'every hero at P4 R4', picks: roster.map((h) => pickOf(h, true)) },
  ]
  for (let i = 0; i < 500; i++) {
    const [kind, rare, rest] = kinds[i % kinds.length]!
    const rareOnes = new Set(shuffled(recordedRare).slice(0, rare()))
    const restShare = rest()
    const picks = roster
      .filter((h) => (RARE.includes(h.faction) ? rareOnes.has(h) : random() < restShare))
      .map((h) => pickOf(h, false))
    selections.push({ kind, picks })
    // One in four again with every unrecorded hero, which can never keep the
    // season before's teams out.
    if (i % 4 === 0)
      selections.push({
        kind,
        picks: [...picks, ...unrecorded.map((h) => pickOf(h, false))],
        same: selections.length - 1,
      })
  }

  for (const kind of [...new Set(selections.map((s) => s.kind))])
    it(`holds the generator's rules for ${kind}`, { timeout: 30_000 }, () => {
      const answers = new Map<number, SlChoice | null>()
      selections.forEach((s, i) => {
        if (s.kind !== kind) return
        const set = chooseSlSet(data, learned, s.picks)
        answers.set(i, set)
        expect(!!set, `selection ${i}: a set exactly when its teams fill every map`).toBe(
          fills(new Set(s.picks.map((p) => p.id))),
        )
        if (set) holds(s.picks, set)
      })
      const again = selections.flatMap((s, i) =>
        s.kind === kind && s.same !== undefined ? [[i, s.same] as const] : [],
      )
      expect(again.map(([i]) => answers.get(i))).toStrictEqual(
        again.map(([, same]) => answers.get(same)),
      )
    })
})
