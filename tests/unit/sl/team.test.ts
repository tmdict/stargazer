import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { deploymentTiles, MAPS } from '@/lib/maps'
import { loadSlData } from '@/lib/pvp/sl/data/codec'
import type { SlData } from '@/lib/pvp/sl/data/types'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import { slFit } from '@/lib/pvp/sl/generator/fit'
import { boardFormations } from '@/lib/pvp/sl/generator/formation'
import { slBoards, type SlBoard } from '@/lib/pvp/sl/generator/setType'
import { previewSwap } from '@/lib/pvp/sl/generator/swapPreview'
import { recordedUnits, slTeamData } from '@/lib/pvp/sl/generator/team'
import type { SlChoice, SlPick } from '@/lib/pvp/sl/generator/types'
import { readSlFile } from '@/lib/pvp/sl/model/reader'
import { CURRENT_SEASON, isPermanentArtifactId } from '@/lib/seasonal'
import { matchVariant, TEAM_VARIANTS } from '@/lib/teams/modes'
import { Team } from '@/lib/types/team'
import { loadCharacters, loadPhantimals } from '@/utils/dataLoader'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'

// The page fetches the file the build emits, so the test serves it the same bytes.
vi.stubGlobal(
  'fetch',
  async () => new Response(readFileSync(new URL('../../../src/pack/pvp/sl.bin', import.meta.url))),
)
const shipped = await loadSlData()
vi.unstubAllGlobals()
// The shipped teams under chosen map keys, so these tests hold whichever
// rotation the shipped file is on.
const fileOn = (keys: readonly string[]): SlData => ({
  ...shipped,
  maps: [...keys],
})
const data = fileOn(TEAM_VARIANTS.sl.maps)
const reader = readSlFile(data)
const faction = new Map(loadCharacters().map((c) => [c.id, c.faction]))
const picks: SlPick[] = [...new Set(data.teams.flatMap((t) => t.heroes))].map((id, i) => ({
  id,
  faction: faction.get(id)!,
  paragon: i % 5,
  refinement: 4,
}))
const chooseOn = (file: SlData, boards: SlBoard[], from = picks) =>
  chooseSlSet(file, reader, from, () => true, boards)
const boards = slBoards(data, 'sl')
const set = chooseOn(data, boards)!
const byTile = (a: readonly number[], b: readonly number[]) => a[0]! - b[0]!
// Every board of a set in its recorded placement.
const recordedOf = (file: SlData, chosen: SlChoice) =>
  chosen.teams.map((team) => ({ units: recordedUnits(file, team) }))
const decoded = (season: number) => {
  const file = { ...data, season }
  return decodeMultiGridStateFromUrl(slTeamData(file, set, picks, boards, recordedOf(file, set)))!
}

// Each board of a saved set against the team it came from, in that team's
// season.
const expectSaved = (
  chosen: SlChoice,
  chosenWith: SlPick[],
  chosenOn: SlBoard[] = boards,
  mode = '5v5',
) => {
  const state = decodeMultiGridStateFromUrl(
    slTeamData(data, chosen, chosenWith, chosenOn, recordedOf(data, chosen)),
  )!
  expect(state.mode).toBe(mode)
  expect(state.boards).toHaveLength(chosen.teams.length)
  expect(state.season).toBe(CURRENT_SEASON)
  state.boards.forEach((board, i) => {
    const choice = chosen.teams[i]!
    const team = (choice.source === 0 ? data : data.before!).teams[choice.team]!
    const placement = team.placements[choice.placement]!
    expect(board.m).toBe(data.maps[team.map])
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
  const gone = Object.keys(MAPS).filter((key) => !current.includes(key))
  const behind = fileOn([...current.slice(0, 3), gone[0]!, gone[1]!])
  const onCurrent = slBoards(behind, 'sl')

  it('stands every board on a current map, and gives a new map the teams of the one it replaced', () => {
    expect(onCurrent.map((board) => board.key)).toEqual(current)
    expect(onCurrent.map((board) => board.source)).toEqual([0, 1, 2, 3, 4])
    expect(onCurrent.map((board) => board.recorded)).toEqual([true, true, true, false, false])
  })

  it('keeps a held map on its own teams wherever the file holds it', () => {
    const shuffled = slBoards(fileOn([...current.slice(0, 3), gone[0]!, current[3]!]), 'sl')
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
    const formations = boardFormations(behind, chosen, onCurrent, false)
    const state = decodeMultiGridStateFromUrl(
      slTeamData(behind, chosen, picks, onCurrent, formations),
    )!
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
  const suggested = boardFormations(data, set, boards, true)

  it('stand each team on its map with the phantimal its heroes summon', () => {
    set.teams.forEach((choice, i) => {
      const placed = suggested[i]!.units
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
    expect(boardFormations(without, set, boards, true)).toEqual(suggested)
  })

  it('are what the saved set holds', () => {
    const state = decodeMultiGridStateFromUrl(slTeamData(data, set, picks, boards, suggested))!
    state.boards.forEach((board, i) => {
      const saved = [
        ...(board.c ?? []),
        ...(board.s ?? []).map(([tile, local]) => [tile, toPhantimalId(local), Team.ALLY]),
      ]
      expect(saved.sort(byTile)).toEqual(
        suggested[i]!.units.map(([tile, id]) => [tile, id, Team.ALLY]).sort(byTile),
      )
    })
  })
})

// The shipped file on its own maps, so a recorded board stands on the map it was
// recorded on.
const onShipped = slBoards(shipped, 'sl')
const shippedSet = chooseOn(shipped, onShipped)!
const shippedFormations = boardFormations(shipped, shippedSet, onShipped, false)

describe('a recorded board', () => {
  it('is explained with every unit on its recorded tile', () => {
    expect(onShipped.some((board) => board.recorded)).toBe(true)
    shippedSet.teams.forEach((team, index) => {
      if (!onShipped[index]!.recorded) return
      const { units, why } = shippedFormations[index]!
      expect(units).toEqual(recordedUnits(shipped, team))
      const explained = why.units.map(({ unit, tile }) => [tile, unit])
      expect(explained.sort(byTile)).toEqual([...units].sort(byTile))
    })
  })
})

describe('a swap tried on a board', () => {
  const chosen = shippedSet
  const tryOn = (index: number, out: number[], into: number[]) => {
    const team = chosen.teams[index]!
    const { units } = shippedFormations[index]!
    const swap = { board: onShipped[index]!, team, units, out, into, picks }
    return previewSwap(shipped, readSlFile(shipped), slFit(shipped), () => true, swap)
  }

  it("keeps every unit and the team's chance when nothing changes", () => {
    chosen.teams.forEach((team, index) => {
      const hero = team.heroes[0]!
      const preview = tryOn(index, [hero], [hero])
      expect(preview).toMatchObject({ joined: [], left: [] })
      expect(preview.chance).toBeCloseTo(team.chance, 12)
    })
  })

  it('brings in the hero swapped in and takes out the one it replaces', () => {
    const index = chosen.teams.findIndex((team) => team.flex.length)
    const { out, options } = chosen.teams[index]!.flex[0]!
    const outTile = shippedFormations[index]!.units.find(([, unit]) => unit === out)![0]
    const preview = tryOn(index, [out], [options[0]!])
    expect(preview.joined.map(([, unit]) => unit)).toContain(options[0])
    expect(preview.left).toContain(outTile)
  })
})
