import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { deploymentTiles } from '@/lib/maps'
import { loadSlData } from '@/lib/pvp/sl/data/codec'
import type { SlData } from '@/lib/pvp/sl/data/types'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import { slBoards, type SlBoard } from '@/lib/pvp/sl/generator/setType'
import { suggestedUnits } from '@/lib/pvp/sl/generator/suggested'
import { slTeamData } from '@/lib/pvp/sl/generator/team'
import type { SlChoice, SlPick } from '@/lib/pvp/sl/generator/types'
import { learnSeason } from '@/lib/pvp/sl/model/models'
import { CURRENT_SEASON, isPermanentArtifactId } from '@/lib/seasonal'
import { matchVariant, TEAM_VARIANTS } from '@/lib/teams/modes'
import { Team } from '@/lib/types/team'
import { loadCharacters, loadPhantimals } from '@/utils/dataLoader'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'

// The page fetches the file the build emits, so the test serves it the same bytes.
vi.stubGlobal(
  'fetch',
  async () =>
    new Response(readFileSync(new URL('../../../src/content/pvp/sl/sl.bin', import.meta.url))),
)
const shipped = await loadSlData()
vi.unstubAllGlobals()
// The shipped teams under chosen map keys, so these tests hold whichever
// rotation the shipped file is on.
const fileOn = (keys: readonly string[]): SlData => ({
  ...shipped,
  maps: shipped.maps.map((map, i) => ({ ...map, key: keys[i]! })),
})
const data = fileOn(TEAM_VARIANTS.sl.maps)
const learned = learnSeason(data)
const faction = new Map(loadCharacters().map((c) => [c.id, c.faction]))
const picks: SlPick[] = [...new Set(data.teams.flatMap((t) => t.heroes))].map((id, i) => ({
  id,
  faction: faction.get(id)!,
  paragon: i % 5,
  refinement: 4,
}))
const chooseOn = (file: SlData, boards: SlBoard[], from = picks) =>
  chooseSlSet(
    file,
    learned,
    from,
    () => true,
    boards.map((board) => board.source),
  )
const boards = slBoards(data, 'sl')
const set = chooseOn(data, boards)!
const byTile = (a: number[], b: number[]) => a[0]! - b[0]!
const decoded = (season: number) =>
  decodeMultiGridStateFromUrl(slTeamData({ ...data, season }, set, picks, boards, []))!

// Each board of a saved set against the team it came from, in that team's
// season.
const expectSaved = (
  chosen: SlChoice,
  chosenWith: SlPick[],
  chosenOn: SlBoard[] = boards,
  mode = '5v5',
) => {
  const state = decodeMultiGridStateFromUrl(slTeamData(data, chosen, chosenWith, chosenOn, []))!
  expect(state.mode).toBe(mode)
  expect(state.boards).toHaveLength(chosen.teams.length)
  expect(state.season).toBe(CURRENT_SEASON)
  state.boards.forEach((board, i) => {
    const choice = chosen.teams[i]!
    const team = (choice.source === 0 ? data : data.before!).teams[choice.team]!
    const placement = team.placements[choice.placement]!
    expect(board.m).toBe(data.maps[team.map]!.key)
    expect([...(board.c ?? [])].sort(byTile)).toEqual(
      placement.c.map(([tile, id]) => [tile, id, Team.ALLY]).sort(byTile),
    )
    expect(board.s ?? []).toEqual(placement.s.map(([tile, id]) => [tile, id, Team.ALLY]))
    expect(board.a?.[0] ?? null).toBe(choice.artifact)
    const levels = (id: number) => chosenWith.find((p) => p.id === id)!
    expect(board.u).toEqual(
      team.heroes
        .flatMap((id) => [
          [Team.ALLY, id, ATTR_PARAGON, levels(id).paragon],
          [Team.ALLY, id, ATTR_REFINEMENT, levels(id).refinement],
        ])
        .filter(([, , , value]) => value !== 0)
        .sort((a, b) => a[1]! - b[1]! || a[2]! - b[2]!),
    )
  })
}

describe('a set saved as a team', () => {
  it('puts each team on its map with its units, artifact, phantimal and the levels chosen with', () => {
    expect(set.teams).toHaveLength(data.maps.length)
    expectSaved(set, picks)
  })

  it('saves a set of three boards as a 3v3 team', () => {
    const onMapOne = slBoards(data, '3v3')
    const three = chooseOn(data, onMapOne)!
    expect(three.teams).toHaveLength(3)
    expectSaved(three, picks, onMapOne, '3v3')
  })

  // A selection with no Celestial or Hypogean hero takes last season's teams too.
  it.skipIf(!data.before)("saves last season's teams the same way", () => {
    const fewer: SlPick[] = [
      ...new Set([...data.teams, ...data.before!.teams].flatMap((t) => t.heroes)),
    ]
      .filter((id) => !['celestial', 'hypogean'].includes(faction.get(id)!))
      .map((id) => ({ id, faction: faction.get(id)!, paragon: 4, refinement: 4 }))
    const chosen = chooseOn(data, boards, fewer)!
    expect(chosen.teams.some((t) => t.source === 1)).toBe(true)
    expectSaved(chosen, fewer)
  })

  // After Stargazer's cutover the file's seasonal ids name the new season's
  // content until the new season's file is copied.
  it('leaves out the seasonal artifacts and phantimals of a file from another season', () => {
    expect(decoded(data.season).boards.some((board) => board.s?.length)).toBe(true)
    const state = decoded(CURRENT_SEASON + 1)
    for (const board of state.boards) {
      expect(board.s).toBeUndefined()
      expect(board.a === undefined || isPermanentArtifactId(board.a[0]!)).toBe(true)
    }
    expect(state.boards.map((board) => board.c)).toEqual(
      decoded(data.season).boards.map((board) => board.c),
    )
  })
})

describe('a file behind the current maps', () => {
  const current = TEAM_VARIANTS.sl.maps
  const behind = fileOn([...current.slice(0, 3), 'gone-a', 'gone-b'])
  const onCurrent = slBoards(behind, 'sl')

  it('stands every board on a current map, and gives a new map the teams of the one it replaced', () => {
    expect(onCurrent.map((board) => board.key)).toEqual(current)
    expect(onCurrent.map((board) => board.source)).toEqual([0, 1, 2, 3, 4])
    expect(onCurrent.map((board) => board.recorded)).toEqual([true, true, true, false, false])
  })

  it('keeps a held map on its own teams wherever the file holds it', () => {
    const shuffled = slBoards(fileOn([...current.slice(0, 3), 'gone', current[3]!]), 'sl')
    expect(shuffled.map((board) => board.source)).toEqual([0, 1, 2, 4, 3])
    expect(shuffled.map((board) => board.recorded)).toEqual([true, true, true, true, false])
  })

  it('leaves the 5v5 and 3v3 types on map 1, which the file still holds', () => {
    for (const type of ['5v5', '3v3'] as const) {
      for (const board of slBoards(behind, type)) {
        expect(board).toEqual({ key: current[0], map: 0, source: 0, recorded: true })
      }
    }
  })

  it('draws held maps as recorded and new maps in the engine formation, and saves as Supreme League', () => {
    const chosen = chooseOn(behind, onCurrent)!
    const units = suggestedUnits(behind, chosen, onCurrent, false)
    expect(units.map((placed) => placed !== null)).toEqual([false, false, false, true, true])
    const state = decodeMultiGridStateFromUrl(slTeamData(behind, chosen, picks, onCurrent, units))!
    expect(
      matchVariant(
        '5v5',
        state.boards.map((board) => board.m),
      ),
    ).toBe('sl')
    const saved = (i: number) => [...(state.boards[i]!.c ?? [])].sort(byTile)
    for (const i of [0, 1, 2]) {
      const choice = chosen.teams[i]!
      const team = (choice.source === 0 ? behind : behind.before!).teams[choice.team]!
      const { c } = team.placements[choice.placement]!
      expect(saved(i)).toEqual(c.map(([tile, id]) => [tile, id, Team.ALLY]).sort(byTile))
    }
    for (const i of [3, 4]) {
      const allyTiles = deploymentTiles(current[i]!, Team.ALLY)
      expect(saved(i).every(([tile]) => allyTiles.has(tile!))).toBe(true)
    }
  })
})

describe("the engine's formations", () => {
  const units = suggestedUnits(data, set, boards, true)

  it('stand each team on its map with the phantimal its heroes summon', () => {
    set.teams.forEach((choice, i) => {
      const placed = units[i]!
      const map = boards[i]!.key
      const tiles = placed.map(([tile]) => tile)
      expect(new Set(tiles).size).toBe(tiles.length)
      expect(tiles.every((tile) => deploymentTiles(map, Team.ALLY).has(tile))).toBe(true)
      const ids = placed.map(([, id]) => id)
      expect(choice.heroes.every((id) => ids.includes(id))).toBe(true)
      const summoned = loadPhantimals().filter((p) =>
        lineupQualifies(p, choice.heroes, (id) => faction.get(id)),
      )
      expect(ids.filter(isPhantimalId)).toEqual(summoned.map((p) => toPhantimalId(p.id)))
    })
  })

  it('read no recorded placement', () => {
    const unplaced = <T extends { placements: unknown[] }>(teams: T[]) =>
      teams.map((team) => ({ ...team, placements: [] }))
    const without: SlData = {
      ...data,
      teams: unplaced(data.teams),
      before: data.before && { ...data.before, teams: unplaced(data.before.teams) },
    }
    expect(suggestedUnits(without, set, boards, true)).toEqual(units)
  })

  it('are what the saved set holds', () => {
    const state = decodeMultiGridStateFromUrl(slTeamData(data, set, picks, boards, units))!
    state.boards.forEach((board, i) => {
      const saved = [
        ...(board.c ?? []),
        ...(board.s ?? []).map(([tile, local]) => [tile, toPhantimalId(local), Team.ALLY]),
      ]
      expect(saved.sort(byTile)).toEqual(
        units[i]!.map(([tile, id]) => [tile, id, Team.ALLY]).sort(byTile),
      )
    })
  })
})
