import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'

import { companionIdsOf } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { loadArtifacts, loadCharacters, loadPhantimals } from '@/lib/dataLoader'
import { configTiles } from '@/lib/maps'
import { decodeSlData, decodeSlFits, encodeSlFits, loadSlData } from '@/lib/pvp/data/codec'
import type { SlData, SlTeam, SlUnit } from '@/lib/pvp/data/types'
import { chooseSlSet } from '@/lib/pvp/generator/chooser'
import { slFit, type SlFit } from '@/lib/pvp/generator/fit'
import { fitRow, fitTable, rowInputs, type FitRow } from '@/lib/pvp/generator/fitTable'
import { slBoards } from '@/lib/pvp/generator/setType'
import type { SlChoice, SlPick } from '@/lib/pvp/generator/types'
import { readSlFile } from '@/lib/pvp/model/reader'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { Team } from '@/lib/types/team'
import { fileTeam, wholeFit } from '../fixtures/slSeason'

// The file a deploy ships, as copied in from the external report generator.
// The page fetches the file the build emits, so the test serves it the same
// bytes.
vi.stubGlobal(
  'fetch',
  async () => new Response(readFileSync(new URL('../../../src/pack/pvp/pvp.bin', import.meta.url))),
)
const data = await loadSlData()
vi.unstubAllGlobals()
const reader = readSlFile(data)
const boards = slBoards(data, TEAM_VARIANTS.sl.maps)
// One store of measured fits for every call, as the worker keeps for a visit.
const fit = slFit(data)
const choose = (picks: SlPick[], on = boards, measured: SlFit = fit) =>
  chooseSlSet(data, reader, picks, () => true, on, measured)
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
const mapTeams = data.maps.flatMap((m) => m.teams)
const named = [...new Set(mapTeams.flatMap((t) => t.heroes))]

// The heroes of the teams in `list` the last evidence rule lets a selection take.
function allowed(list: readonly SlTeam[], picked: ReadonlySet<number>): number[][] {
  const proof = data.evidence.at(-1)!
  const meets = (count: number, minimum: number) => count + 1e-6 >= minimum
  const open = list.filter((t) => t.heroes.every((id) => picked.has(id)))
  const groupGames = new Map<number | null, number>()
  for (const t of open) groupGames.set(t.family, (groupGames.get(t.family) ?? 0) + t.games)
  return open
    .filter(
      (t) =>
        (t.family !== null || proof.oneOffs) &&
        meets(groupGames.get(t.family)!, proof.groupGames) &&
        t.decided >= 1 &&
        t.wins >= proof.wins &&
        (meets(t.players, proof.players) || meets(t.games, proof.games)),
    )
    .map((t) => t.heroes)
}

// Whether the selected heroes make a set: from each board's own map, else with
// the rows of every map on a board its map leaves none, else on every board.
function fills(picked: ReadonlySet<number>): boolean {
  const fill = (pools: number[][][], board = 0, used = new Set<number>()): boolean =>
    board === pools.length ||
    pools[board]!.some(
      (team) =>
        !team.some((id) => used.has(id)) && fill(pools, board + 1, new Set([...used, ...team])),
    )
  const own = boards.map((b) => allowed(data.maps[b.source!]!.teams, picked))
  const every = allowed(data.everyMap, picked)
  return (
    fill(own) || fill(own.map((pool) => (pool.length ? pool : every))) || fill(own.map(() => every))
  )
}

// The generator's rules for the set it chose for `picks`.
function holds(picks: SlPick[], chosen = choose(picks)): SlChoice {
  expect(chosen).not.toBeNull()
  const set = chosen!
  expect(set.teams).toHaveLength(boards.length)
  const used = set.teams.flatMap((t) => t.heroes)
  expect(new Set(used).size).toBe(used.length)
  const selected = new Set(picks.map((p) => p.id))
  expect(used.every((id) => selected.has(id))).toBe(true)
  const free = new Set([...selected].filter((id) => !used.includes(id)))
  set.teams.forEach((t, i) => {
    const team = fileTeam(data, t)
    if (t.source !== null) expect(t.source).toBe(boards[i]!.source)
    expect(t.heroes).toEqual(team.heroes)
    expect(t.artifact).not.toBeNull()
    expect(t.chance).toBeGreaterThan(0)
    expect(t.chance).toBeLessThan(1)
    const placements = t.source === null ? 0 : data.maps[t.source]!.teams[t.team]!.placements.length
    expect(t.placement).toBeGreaterThanOrEqual(0)
    expect(t.placement).toBeLessThan(Math.max(placements, 1))
    expect(
      t.flex.every((f) => t.heroes.includes(f.out) && f.options.every((id) => free.has(id))),
    ).toBe(true)
    // Every one-hero swap of a group core hero is shown, past the limit if need
    // be, and the other one-hero swaps and then the two-hero swaps fill the rows
    // it leaves. A two-hero swap takes heroes the set leaves free, for two of the
    // team's that are neither core nor out in a one-hero swap.
    const groupCore = t.family === null ? [] : data.families[t.family]!.core
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
    Math.abs(sum(set.odds.slice(Math.floor(boards.length / 2) + 1)) - set.chance),
  ).toBeLessThan(1e-12)
  return set
}

describe('the shipped PvP data', () => {
  it('names only heroes Stargazer knows, and companions their heroes spawn', () => {
    expect(data.order.filter((id) => !heroes.has(id))).toEqual([])
    expect(data.everyMap.every((t) => t.heroes.every((id) => heroes.has(id)))).toBe(true)
    const strays: SlUnit[] = []
    for (const t of mapTeams) {
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
    expect(strays).toEqual([])
  })

  // After a cutover the ids name the new season's content, so they are only
  // checked while the file's season is Stargazer's.
  it.runIf(data.season === CURRENT_SEASON)('uses the season’s own artifacts and phantimals', () => {
    const artifacts = new Set(loadArtifacts().map((a) => a.id))
    const phantimals = new Set(loadPhantimals().map((p) => p.id))
    for (const t of [...mapTeams, ...data.everyMap]) {
      expect(t.artifacts.map(([id]) => id).filter((id) => !artifacts.has(id))).toEqual([])
    }
    for (const t of mapTeams) {
      const used = t.placements.flatMap((p) => (p.s[0] ? [p.s[0][1]] : []))
      expect(used.filter((id) => !phantimals.has(id))).toEqual([])
    }
    const rated = [...Object.keys(data.model.artifacts).map(Number), ...data.fallback.flat()]
    expect(rated.filter((id) => !artifacts.has(id))).toEqual([])
  })

  // An edited copy, sealed with the pack's key as the writer seals the file.
  const sealed = (edit: (copy: SlData) => void): Uint8Array<ArrayBuffer> => {
    const copy = structuredClone(data)
    edit(copy)
    const key = readFileSync(new URL('../../../src/pack/pvp/pvp.key', import.meta.url), 'utf8')
    const iv = randomBytes(12)
    const cipher = createCipheriv(
      'aes-256-gcm',
      createHash('sha256').update(`${key.trim()}stargazer-pvp`).digest(),
      iv,
    )
    const body = [cipher.update(deflateRawSync(JSON.stringify(copy))), cipher.final()]
    return new Uint8Array(Buffer.concat([iv, ...body, cipher.getAuthTag()]))
  }

  it('refuses a file whose rows or indexes do not match its teams and maps', async () => {
    await expect(decodeSlData(sealed(() => {}))).resolves.toBeTruthy()
    const team = data.maps[0]!.teams[0]!
    for (const edit of [
      (c: SlData) => (c.maps[0]!.teams[0]!.pick = [[null, team.placements.length]]),
      (c: SlData) => (c.maps[1]!.key = c.maps[0]!.key),
      (c: SlData) => c.maps[0]!.records.pop(),
      (c: SlData) => (c.everyMap[0]!.home = c.maps.length),
      (c: SlData) => (c.seasons[0]!.weight = 0.3),
      (c: SlData) =>
        (c.maps.flatMap((m) => m.teams).find((t) => t.family !== null)!.record = [1, 1, 0]),
      (c: SlData) =>
        (c.maps.flatMap((m) => m.teams).find((t) => t.family === null)!.record = [1, 1] as never),
    ])
      await expect(decodeSlData(sealed(edit))).rejects.toThrow()
  })
})

describe('the fit table of the shipped PvP data', () => {
  const team = data.everyMap[0]!
  const made = fitRow(data, team.heroes, false)
  const empty: FitRow = { points: made.row.points.map(() => null), refused: [] }
  const table = fitTable(
    'stamp',
    data.everyMap.map((_, index) => (index === 0 ? made.row : empty)),
    data.everyMap.map(() => empty),
  )

  it('gives a store the fits it would measure, on every preset map', () => {
    const measured = slFit(data)
    const given = slFit(data, false, table)
    const presets = slBoards(data, table.maps).filter((board) => fit.stands(board, team.heroes))
    expect(presets.length).toBeGreaterThan(boards.length)
    for (const board of presets) {
      expect(given.known(board, team.heroes)).toBe(measured.measure(board, team.heroes))
    }
  })

  it('comes back from its file as written, and not for a data file of other lineups', async () => {
    const bytes = await encodeSlFits(table)
    expect(await decodeSlFits(bytes, data)).toEqual(table)
    const fewer = { ...data, everyMap: data.everyMap.slice(1) }
    await expect(decodeSlFits(bytes, fewer)).rejects.toThrow()
  })

  // A kept row is used again while its inputs are the same, so they hold each
  // list its placements read and none of the others.
  it('names the lists a row was made from, so only a change to one makes it again', () => {
    const inputs = (lists: SlData['placement']['lists']): string =>
      JSON.stringify(
        rowInputs({ ...data, placement: { ...data.placement, lists } }, team, false, made.reads),
      )
    const { lists } = data.placement
    const unread = Object.keys(lists).find((name) => !made.reads.lists.includes(name))!
    expect(made.reads.lists.length).toBeGreaterThan(0)
    expect(inputs({ ...lists, [made.reads.lists[0]!]: [] })).not.toBe(inputs(lists))
    expect(inputs({ ...lists, [unread]: [] })).toBe(inputs(lists))
  })
})

describe('chooseSlSet on the shipped data', () => {
  // A team only an earlier season recorded on a map, with games enough for the
  // last evidence rule, is the one team a selection of its heroes makes there.
  it('draws teams only an earlier season recorded, on the league maps and arena1', () => {
    const checked = [...new Set([...TEAM_VARIANTS.sl.maps, 'arena1'])].filter((key) => {
      const source = data.maps.findIndex((m) => m.key === key)
      expect(source).toBeGreaterThanOrEqual(0)
      const index = data.maps[source]!.teams.findIndex(
        (t) =>
          !t.artifacts.length &&
          t.placements.every((p) => !p.s.length) &&
          allowed([t], new Set(t.heroes)).length > 0,
      )
      if (index < 0) return false
      const team = data.maps[source]!.teams[index]!
      const set = choose(
        team.heroes.map((id) => pick(id)),
        slBoards(data, [key]),
      )
      expect(set?.teams.map((t) => [t.source, t.team])).toEqual([[source, index]])
      expect(set?.teams[0]!.artifact).not.toBeNull()
      return true
    })
    expect(checked.length).toBeGreaterThan(0)
  })

  // Only a team outside every group carries a record, and a pack may hold none.
  it.runIf(mapTeams.some((t) => t.record))(
    'shows a team outside every group its own record under its board',
    () => {
      const keys = [...new Set([...TEAM_VARIANTS.sl.maps, 'arena1'])]
      const map = data.maps.find(
        (m) =>
          keys.includes(m.key) &&
          m.teams.some((t) => t.family === null && allowed([t], new Set(t.heroes)).length),
      )!
      const team = map.teams.find(
        (t) => t.family === null && allowed([t], new Set(t.heroes)).length,
      )!
      const set = choose(
        team.heroes.map((id) => pick(id)),
        slBoards(data, [map.key]),
      )
      expect(set?.teams[0]!.heroes).toEqual(team.heroes)
      expect(set?.teams[0]!.comp).toEqual(team.record)
    },
  )

  it('counts upgrades against a team', () => {
    const full = holds(named.map((id) => pick(id)))
    const low = holds(named.map((id) => pick(id, 0, 0)))
    expect(low.chance).toBeLessThanOrEqual(full.chance)
  })

  // A row of every map can come from a map with more ally tiles than a board
  // with records of its own, whose tiles the engine could not place it on.
  it('gives a team a board with records only where its map has a tile for each unit', () => {
    const board = boards.find((b) => b.source !== null)!
    const tiles = configTiles(board.layout.config, Team.ALLY).size
    expect(fit.stands(board, named.slice(0, tiles + 1))).toBe(false)
    expect(fit.stands(board, data.maps[board.source!]!.teams[0]!.heroes)).toBe(true)
  })
})

// Seeded and random selections, the same on every run: a few heroes, which
// often leave a map's own teams short, partial ones, near-full ones, some
// again with heroes no recorded team holds, each hero at random levels, and
// every hero at P4 R4.
describe('chooseSlSet on 626 seeded selections', () => {
  let seed = 20261024
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
  const level = () => Math.floor(random() * 5)
  const roster = [...heroes.values()]
  const held = new Set(named)
  const pickOf = (h: { id: number; faction: string }, top: boolean): SlPick => ({
    id: h.id,
    faction: h.faction,
    paragon: top ? 4 : level(),
    refinement: top ? 4 : level(),
  })
  // Heroes no team holds, as a newly released one is: those Stargazer knows,
  // and stand-ins under ids no hero has.
  const spare = Math.max(...heroes.keys()) + 1
  const unrecorded = [
    ...roster.filter((h) => !held.has(h.id)),
    ...Array.from({ length: 4 }, (_, i) => ({ id: spare + i, faction: 'celestial' })),
  ]
  // What share of the heroes a kind of selection takes.
  const kinds: [string, () => number][] = [
    ['few heroes', () => 0.15 + random() * 0.15],
    ['a part of the heroes', () => 0.3 + random() * 0.3],
    ['most heroes', () => 0.6 + random() * 0.25],
    ['nearly every hero', () => 0.85 + random() * 0.15],
  ]
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
    const [kind, share] = kinds[i % kinds.length]!
    const kept = share()
    const picks = roster.filter(() => random() < kept).map((h) => pickOf(h, false))
    selections.push({ kind, picks })
    // One in four again with every unrecorded hero.
    if (i % 4 === 0)
      selections.push({
        kind,
        picks: [...picks, ...unrecorded.map((h) => pickOf(h, false))],
        same: selections.length - 1,
      })
  }

  // The selections that fall back on every board would wait most of a minute
  // on measured fits; search.test.ts checks the search against fits.
  const whole = wholeFit(data)

  for (const kind of [...new Set(selections.map((s) => s.kind))])
    it(`holds the generator's rules for ${kind}`, () => {
      const answers = new Map<number, SlChoice | null>()
      selections.forEach((s, i) => {
        if (s.kind !== kind) return
        const set = choose(s.picks, boards, whole)
        answers.set(i, set)
        expect(
          !!set,
          `selection ${i}: a set exactly when the teams it may take fill every map`,
        ).toBe(fills(new Set(s.picks.map((p) => p.id))))
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
