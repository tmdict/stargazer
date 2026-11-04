import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { inPhantimalBand, isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import {
  configTiles,
  deploymentTiles,
  MAPS,
  presetLayout,
  tilesLayout,
  type MapLayout,
} from '@/lib/maps'
import { PlacementBoard } from '@/lib/placement/board'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { ruleUnit } from '@/lib/placement/reach'
import { PlacementScorer } from '@/lib/placement/score'
import type { PlacementTeam } from '@/lib/placement/types'
import { loadSlData } from '@/lib/pvp/sl/data/codec'
import type { SlData, SlUnit } from '@/lib/pvp/sl/data/types'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import { slFit } from '@/lib/pvp/sl/generator/fit'
import {
  boardDraws,
  boardPlacement,
  boardTeam,
  engineFormation,
  shownFormation,
} from '@/lib/pvp/sl/generator/formation'
import { layoutBoards, slBoards, type SlBoard } from '@/lib/pvp/sl/generator/setType'
import { previewSwap } from '@/lib/pvp/sl/generator/swapPreview'
import { recordedUnits, slTeamData } from '@/lib/pvp/sl/generator/team'
import type { SlChoice, SlChoiceTeam, SlPick } from '@/lib/pvp/sl/generator/types'
import { readSlFile } from '@/lib/pvp/sl/model/reader'
import { CURRENT_SEASON, isPermanentArtifactId } from '@/lib/seasonal'
import { matchVariant, TEAM_VARIANTS } from '@/lib/teams/modes'
import { State } from '@/lib/types/state'
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
// Every board of a set as the page draws it: in its team's recorded placement,
// or the engine's for a team with none. boardDraws would also have the
// engine explain a recorded placement, which `data`'s renamed maps can leave
// with a unit off its map's ally tiles, so it is left out here.
const drawnOf = (file: SlData, chosen: SlChoice, on: SlBoard[] = boards) =>
  chosen.teams.map((team, i) => ({
    units: recordedUnits(file, team) ?? engineFormation(file, team, on[i]!).units,
  }))
const decoded = (season: number) => {
  const file = { ...data, season }
  return decodeMultiGridStateFromUrl(slTeamData(file, set, picks, boards, drawnOf(file, set)))!
}

// Each board of a saved set against the team it came from, in that team's
// season.
const expectSaved = (
  chosen: SlChoice,
  chosenWith: SlPick[],
  chosenOn: SlBoard[] = boards,
  mode = '5v5',
) => {
  const formations = drawnOf(data, chosen, chosenOn)
  const state = decodeMultiGridStateFromUrl(
    slTeamData(data, chosen, chosenWith, chosenOn, formations),
  )!
  expect(state.mode).toBe(mode)
  expect(state.boards).toHaveLength(chosen.teams.length)
  expect(state.season).toBe(CURRENT_SEASON)
  state.boards.forEach((board, i) => {
    const choice = chosen.teams[i]!
    const team = (choice.source === 0 ? data : data.before!).teams[choice.team]!
    expect(board.m).toBe(data.maps[team.map])
    const { units } = formations[i]!
    const saved = [
      ...(board.c ?? []),
      ...(board.s ?? []).map(([tile, local]) => [tile, toPhantimalId(local), Team.ALLY]),
    ]
    expect(saved.sort(byTile)).toEqual(
      units.map(([tile, id]) => [tile, id, Team.ALLY]).sort(byTile),
    )
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
    // A recorded placement keeps its heroes' tiles. The engine places a team
    // with none afresh, without the phantimal.
    const recorded = set.teams.map((choice) => !!recordedUnits(data, choice))
    expect(state.boards.filter((_, i) => recorded[i]).map((board) => board.c)).toEqual(
      decoded(data.season)
        .boards.filter((_, i) => recorded[i])
        .map((board) => board.c),
    )
  })
})

describe('a file behind the current maps', () => {
  const current = TEAM_VARIANTS.sl.maps
  const gone = Object.keys(MAPS).filter((key) => !current.includes(key))
  const behind = fileOn([...current.slice(0, 3), gone[0]!, gone[1]!])
  const onCurrent = slBoards(behind, 'sl')

  it('stands every board on a current map, and gives a new map the teams of every map', () => {
    expect(onCurrent.map((board) => board.layout.key)).toEqual(current)
    expect(onCurrent.map((board) => board.source)).toEqual([0, 1, 2, null, null])
  })

  it('keeps a held map on its own teams wherever the file holds it', () => {
    const shuffled = slBoards(fileOn([...current.slice(0, 3), gone[0]!, current[3]!]), 'sl')
    expect(shuffled.map((board) => board.source)).toEqual([0, 1, 2, 4, null])
  })

  it('leaves the 5v5 and 3v3 types on map 1, which the file still holds', () => {
    for (const type of ['5v5', '3v3'] as const) {
      for (const board of slBoards(behind, type)) {
        expect(board).toEqual({ layout: presetLayout(current[0]!), map: 0, source: 0 })
      }
    }
  })

  it('draws held maps as recorded and new maps in the engine formation, and saves as Supreme League', () => {
    const chosen = chooseOn(behind, onCurrent)!
    const draws = boardDraws(behind, chosen, onCurrent)
    const formations = draws.map((draw) => shownFormation(draw, false))
    expect(draws.map((draw) => !!draw.played)).toEqual(
      chosen.teams.map((team, i) => i < 3 && !!recordedUnits(behind, team)),
    )
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
    const held = [0, 1, 2].filter((i) => draws[i]!.played)
    expect(held.map(saved)).toEqual(
      held.map((i) =>
        draws[i]!.played!.units.filter(([, id]) => !inPhantimalBand(id))
          .map(([tile, id]) => [tile, id, Team.ALLY])
          .sort(byTile),
      ),
    )
    current.forEach((key, i) => {
      const allyTiles = deploymentTiles(key, Team.ALLY)
      expect(saved(i).every(([tile]) => allyTiles.has(tile!))).toBe(true)
    })
  })
})

describe('a Map Editor map', () => {
  // The first Supreme League map with only its first `ally` ally tiles.
  const trimmed = (ally: number): MapLayout => {
    const tiles = MAPS[TEAM_VARIANTS.sl.maps[0]!]!.grid.flatMap(({ type, hex }) =>
      hex.map((id) => [id, type]),
    )
    const kept = tiles.filter(([, state]) => state === State.AVAILABLE_ALLY).slice(0, ally)
    return tilesLayout([...tiles.filter(([, state]) => state !== State.AVAILABLE_ALLY), ...kept])
  }

  it('takes a set drawn in the engine formation on its own tiles', () => {
    const layout = trimmed(9)
    const on = layoutBoards(data, [layout])
    const chosen = chooseOn(data, on)!
    const [draw] = boardDraws(data, chosen, on)
    expect(draw!.played).toBeNull()
    const tiles = configTiles(layout.config, Team.ALLY)
    expect(draw!.engine!.units.every(([tile]) => tiles.has(tile))).toBe(true)
  })

  it('takes no set when no team has a tile for each of its units', () => {
    expect(chooseOn(data, layoutBoards(data, [trimmed(4)]))).toBeNull()
  })
})

describe("the engine's formations", () => {
  const engineOf = (file: SlData) =>
    set.teams.map((team, i) => engineFormation(file, team, boards[i]!))
  const suggested = engineOf(data)

  it('stand each team on its map with the phantimal its heroes summon', () => {
    set.teams.forEach((choice, i) => {
      const placed = suggested[i]!.units
      const map = boards[i]!.layout.key
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
    expect(engineOf(without)).toEqual(suggested)
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
const shippedDraws = boardDraws(shipped, shippedSet, onShipped)
const shippedFormations = shippedDraws.map((draw) => shownFormation(draw, false))

// How much of its phantimal's own goals, its Spirit Mark's, a team meets with
// its units on these tiles.
const phantimalMet = (
  team: PlacementTeam,
  choice: SlChoiceTeam,
  board: SlBoard,
  units: readonly SlUnit[],
): number => {
  const placing = new PlacementBoard(team, board.layout, PLACEMENT_LOOKUPS)
  const scorer = new PlacementScorer(placing, team, boardPlacement(shipped, board, choice))
  const tileOf = new Map(units.map(([hexId, unit]) => [unit, hexId]))
  placing.place(placing.units.map((unit) => tileOf.get(unit)!))
  return scorer
    .ownGoals()
    .filter(
      ({ source, owner }) => source === 'unit' && ruleUnit(owner as number) === team.phantimal,
    )
    .reduce((sum, { met }) => sum + (met ?? 0), 0)
}

const keepsUnmoved = (recorded: readonly SlUnit[], drawn: readonly SlUnit[], moved: number[]) => {
  const drawnTile = new Map(drawn.map(([hexId, unit]) => [unit, hexId]))
  return recorded.every(
    ([hexId, unit]) => moved.includes(ruleUnit(unit)) || drawnTile.get(unit) === hexId,
  )
}

describe('a recorded board', () => {
  it('keeps every unit on its recorded tile but those moved for the Spirit Mark, and is explained as drawn', () => {
    expect(onShipped.some((board) => board.source !== null)).toBe(true)
    shippedSet.teams.forEach((team, index) => {
      const played = shippedDraws[index]!.played
      expect(!!played).toBe(onShipped[index]!.source !== null && !!recordedUnits(shipped, team))
      if (!played) return
      const { units, why, moved } = played
      expect(keepsUnmoved(recordedUnits(shipped, team)!, units, moved)).toBe(true)
      const explained = why.units.map(({ unit, tile }) => [tile, unit])
      expect(explained.sort(byTile)).toEqual([...units].sort(byTile))
    })
  })

  // The shipped teams with a recorded phantimal, each on the map it was recorded on.
  it('moves the phantimal, and at most one hero, only where its Spirit Mark lands better', () => {
    const tried = shipped.teams.flatMap((t, index) => {
      if (!t.placements[0]?.s.length) return []
      const choice: SlChoiceTeam = {
        source: 0,
        team: index,
        heroes: t.heroes.filter((id) => !inPhantimalBand(id)),
        family: t.family,
        chance: 0,
        comp: null,
        artifact: t.artifacts[0]?.[0] ?? null,
        placement: 0,
        core: [],
        flex: [],
        pairs: [],
      }
      const board: SlBoard = { layout: presetLayout(shipped.maps[t.map]!)!, map: 0, source: t.map }
      const team = boardTeam(shipped, choice.heroes, choice.artifact)
      const recorded = recordedUnits(shipped, choice)!
      if (!recorded.some(([, unit]) => unit === team.phantimal)) return []
      return [{ choice, board, team, recorded }]
    })
    const drawn = tried.slice(0, 60).map(({ choice, board, team, recorded }) => {
      const { units, moved } = boardDraws(shipped, { chance: 0, odds: [], teams: [choice] }, [
        board,
      ])[0]!.played!
      return {
        moved,
        phantimal: team.phantimal,
        kept: keepsUnmoved(recorded, units, moved),
        asRecorded: JSON.stringify(units) === JSON.stringify(recorded),
        gain:
          phantimalMet(team, choice, board, units) - phantimalMet(team, choice, board, recorded),
      }
    })
    const moves = drawn.filter(({ moved }) => moved.length)
    const keeps = drawn.filter(({ moved }) => !moved.length)
    expect(moves.length).toBeGreaterThan(0)
    expect(keeps.length).toBeGreaterThan(0)
    expect(drawn.every(({ kept }) => kept)).toBe(true)
    expect(
      moves.every(
        ({ moved, phantimal, gain }) =>
          moved.filter((unit) => unit !== phantimal).length <= 1 &&
          (!moved.includes(phantimal!) || moved[0] === phantimal) &&
          gain > 0,
      ),
    ).toBe(true)
    expect(keeps.every(({ asRecorded }) => asRecorded)).toBe(true)
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
