import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { companionIdsOf } from '@/lib/characters/companion'
import { inPhantimalBand, isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { toSynergyId } from '@/lib/characters/synergy'
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
import { loadSlData } from '@/lib/pvp/data/codec'
import type { SlData, SlUnit } from '@/lib/pvp/data/types'
import { chooseSlSet } from '@/lib/pvp/generator/chooser'
import { slFit } from '@/lib/pvp/generator/fit'
import {
  boardDraws,
  boardPlacement,
  boardTeam,
  engineFormation,
  shownFormation,
  sideExplanation,
  summonedPhantimal,
} from '@/lib/pvp/generator/formation'
import { layoutBoards, slBoards, type SlBoard } from '@/lib/pvp/generator/setType'
import { previewSwap } from '@/lib/pvp/generator/swapPreview'
import { recordedUnits, slTeamData } from '@/lib/pvp/generator/team'
import type { SlChoice, SlChoiceTeam, SlPick } from '@/lib/pvp/generator/types'
import { readSlFile } from '@/lib/pvp/model/reader'
import { CURRENT_SEASON, isPermanentArtifactId } from '@/lib/seasonal'
import { DEFAULT_VARIANT, matchVariant, TEAM_VARIANTS, variantMaps } from '@/lib/teams/modes'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { loadCharacters, loadPhantimals } from '@/utils/dataLoader'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'
import { fileTeam, wholeFit } from '../fixtures/slSeason'

// The page fetches the file the build emits, so the test serves it the same bytes.
vi.stubGlobal(
  'fetch',
  async () => new Response(readFileSync(new URL('../../../src/pack/pvp/pvp.bin', import.meta.url))),
)
const data = await loadSlData()
vi.unstubAllGlobals()
const reader = readSlFile(data)
const faction = new Map(loadCharacters().map((c) => [c.id, c.faction]))
const mapTeams = data.maps.flatMap((m) => m.teams)
const picks: SlPick[] = [...new Set(mapTeams.flatMap((t) => t.heroes))].map((id, i) => ({
  id,
  faction: faction.get(id)!,
  paragon: i % 5,
  refinement: 4,
}))
const chooseOn = (file: SlData, boards: SlBoard[], from = picks) =>
  chooseSlSet(file, reader, from, () => true, boards)
const boards = slBoards(data, TEAM_VARIANTS.sl.maps)
const set = chooseOn(data, boards)!
const draws = boardDraws(data, set, boards)
const formations = draws.map((draw) => shownFormation(draw, false))
const byTile = (a: readonly number[], b: readonly number[]) => a[0]! - b[0]!
// Every board of a set in its team's recorded placement, or the engine's for a
// team with none, with no unit moved for the Spirit Mark, so a file of another
// season draws the same tiles.
const drawnOf = (file: SlData, chosen: SlChoice, on: SlBoard[] = boards) =>
  chosen.teams.map((team, i) => ({
    units: recordedUnits(file, team) ?? engineFormation(file, team, on[i]!).units,
  }))
const decoded = (season: number) => {
  const file = { ...data, season }
  return decodeMultiGridStateFromUrl(slTeamData(file, set, picks, boards, drawnOf(file, set)))!
}

// Each board of a saved set against the team it came from.
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
    const team = fileTeam(data, choice)
    expect(board.m).toBe(chosenOn[i]!.layout.key)
    if (choice.source !== null) expect(data.maps[choice.source]!.key).toBe(board.m)
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
    expect(set.teams).toHaveLength(boards.length)
    expectSaved(set, picks)
  })

  it('saves a set of three boards as a 3v3 team', () => {
    const onMapOne = slBoards(data, variantMaps('3v3', DEFAULT_VARIANT))
    const three = chooseOn(data, onMapOne)!
    expect(three.teams).toHaveLength(3)
    expectSaved(three, picks, onMapOne, '3v3')
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

// The shipped file with the last two league maps under keys no entry holds,
// as a file from before a rotation has them.
describe('a file behind the current maps', () => {
  const current = TEAM_VARIANTS.sl.maps
  const gone = Object.keys(MAPS).filter((key) => !data.maps.some((m) => m.key === key))
  const renamed = new Map(current.slice(3).map((key, i) => [key, gone[i]!]))
  const behind: SlData = {
    ...data,
    maps: data.maps.map((m) => ({ ...m, key: renamed.get(m.key) ?? m.key })),
  }
  const onCurrent = slBoards(behind, current)
  const keyOf = (source: number | null) => (source === null ? null : behind.maps[source]!.key)

  it('stands every board on a current map, and gives a new map the rows of every map', () => {
    expect(onCurrent.map((board) => board.layout.key)).toEqual(current)
    expect(onCurrent.map((board) => keyOf(board.source))).toEqual([
      ...current.slice(0, 3),
      null,
      null,
    ])
  })

  it('leaves the 5v5 and 3v3 types on map 1, which the file still holds', () => {
    const source = behind.maps.findIndex((m) => m.key === current[0])
    for (const mode of ['5v5', '3v3'] as const) {
      for (const board of slBoards(behind, variantMaps(mode, DEFAULT_VARIANT))) {
        expect(board).toEqual({ layout: presetLayout(current[0]!), map: 0, source })
      }
    }
  })

  it('draws held maps as recorded and new maps in the engine formation, and saves as Supreme League', () => {
    const chosen = chooseSlSet(behind, reader, picks, () => true, onCurrent, wholeFit(behind))!
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

  it('offers no swap that leaves its team short of tiles', () => {
    const fit = slFit(data)
    const swapped: number[][] = []
    for (const ally of [5, 6, 7, 8]) {
      const on = layoutBoards(data, [trimmed(ally)])
      const team = chooseOn(data, on)?.teams[0]
      if (!team) continue
      const into = (out: number[], heroes: number[]) =>
        team.heroes.map((id) => (out.includes(id) ? heroes[out.indexOf(id)]! : id))
      const all = [
        ...team.flex.flatMap(({ out, options }) => options.map((id) => into([out], [id]))),
        ...team.pairs.flatMap(({ out, options }) => options.map((ids) => into(out, ids))),
      ]
      expect(all.every((heroes) => fit.stands(on[0]!, heroes))).toBe(true)
      swapped.push(...all)
    }
    expect(swapped.length).toBeGreaterThan(0)
  })
})

describe('a side placed by hand', () => {
  const board = boards[0]!
  const choice = set.teams[0]!
  const { units } = engineFormation(data, choice, board)
  const free = [...deploymentTiles(board.layout.key, Team.ALLY)].find(
    (tile) => !units.some(([used]) => used === tile),
  )!
  const explained = (side: SlUnit[]) => sideExplanation(data, board.layout, side, choice.artifact)

  it('is explained where it stands when the engine would place each of its units', () => {
    expect(explained(units)).not.toBeNull()
  })

  it('is not explained with a synergy copy or a companion its heroes do not summon', () => {
    const stray = loadCharacters()
      .map((c) => c.id)
      .filter((id) => !choice.heroes.includes(id))
      .flatMap(companionIdsOf)[0]!
    expect(explained([...units, [free, toSynergyId(choice.heroes[0]!)]])).toBeNull()
    expect(explained([...units, [free, stray]])).toBeNull()
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
      maps: data.maps.map((m) => ({ ...m, teams: unplaced(m.teams) })),
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

// How much of its phantimal's own goals, its Spirit Mark's, a team meets with
// its units on these tiles.
const phantimalMet = (
  team: PlacementTeam,
  choice: SlChoiceTeam,
  board: SlBoard,
  units: readonly SlUnit[],
): number => {
  const placing = new PlacementBoard(team, board.layout, PLACEMENT_LOOKUPS)
  const scorer = new PlacementScorer(placing, team, boardPlacement(data, board, choice))
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
    expect(boards.some((board) => board.source !== null)).toBe(true)
    set.teams.forEach((team, index) => {
      const played = draws[index]!.played
      expect(!!played).toBe(boards[index]!.source !== null && !!recordedUnits(data, team))
      if (!played) return
      const { units, why, moved } = played
      expect(keepsUnmoved(recordedUnits(data, team)!, units, moved)).toBe(true)
      const explained = why.units.map(({ unit, tile }) => [tile, unit])
      expect(explained.sort(byTile)).toEqual([...units].sort(byTile))
    })
  })

  // A shipped team in its first placement.
  const choiceOf = (source: number, index: number): SlChoiceTeam => {
    const t = data.maps[source]!.teams[index]!
    return {
      source,
      team: index,
      heroes: t.heroes,
      family: t.family,
      chance: 0,
      comp: null,
      artifact: t.artifacts[0]?.[0] ?? null,
      placement: 0,
      core: [],
      flex: [],
      pairs: [],
    }
  }

  // A shipped team alone on the map it was recorded on.
  const onOwnMap = (source: number, index: number) => {
    const t = data.maps[source]!.teams[index]!
    const choice = choiceOf(source, index)
    const board: SlBoard = { layout: presetLayout(data.maps[source]!.key)!, map: 0, source }
    const played = boardDraws(data, { chance: 0, odds: [], teams: [choice] }, [board])[0]!.played!
    return { t, choice, board, played }
  }

  it('moves nothing for the Spirit Mark on the Supreme League maps, which play without the marks', () => {
    // A team whose units the Spirit Mark moves when it stands alone on its map.
    const mover = boards
      .flatMap((board, at) =>
        data.maps[board.source!]!.teams.flatMap((t, index) =>
          t.placements[0]?.s.length ? [{ at, index, source: board.source! }] : [],
        ),
      )
      .find(({ source, index }) => onOwnMap(source, index).played.moved.length > 0)!
    expect(mover).toBeDefined()
    const teams = boards.map((board, i) =>
      i === mover.at ? choiceOf(mover.source, mover.index) : choiceOf(board.source!, 0),
    )
    const drawn = boardDraws(data, { chance: 0, odds: [], teams }, boards)
    expect(drawn.map((draw) => draw.played?.moved ?? [])).toEqual(teams.map(() => []))
    expect(drawn[mover.at]!.played!.units).toEqual(recordedUnits(data, teams[mover.at]!))
  })

  // The first shipped teams of each map with a recorded phantimal, each on its map.
  it('moves the phantimal, and at most one hero, only where its Spirit Mark lands better', () => {
    const tried = data.maps.flatMap((m, source) =>
      m.teams
        .flatMap((t, index) => (t.placements[0]?.s.length ? [{ source, index }] : []))
        .slice(0, 8),
    )
    const drawn = tried.flatMap(({ source, index }) => {
      const { choice, board, played } = onOwnMap(source, index)
      const team = boardTeam(data, choice.heroes, choice.artifact)
      const recorded = recordedUnits(data, choice)!
      if (!recorded.some(([, unit]) => unit === team.phantimal)) return []
      const { units, moved } = played
      return [
        {
          moved,
          phantimal: team.phantimal,
          kept: keepsUnmoved(recorded, units, moved),
          asRecorded: JSON.stringify(units) === JSON.stringify(recorded),
          gain:
            phantimalMet(team, choice, board, units) - phantimalMet(team, choice, board, recorded),
        },
      ]
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

  // A board of an earlier season recorded no phantimal.
  it('places the phantimal its heroes summon on a board that recorded none, without listing it as moved', () => {
    const tried = data.maps.flatMap((m, source) =>
      m.teams
        .flatMap((t, index) =>
          t.placements[0] &&
          !t.placements[0].s.length &&
          summonedPhantimal(data, t.heroes) !== undefined
            ? [{ source, index }]
            : [],
        )
        .slice(0, 3),
    )
    expect(tried.length).toBeGreaterThan(0)
    for (const { source, index } of tried) {
      const { t, choice, played } = onOwnMap(source, index)
      const phantimal = summonedPhantimal(data, t.heroes)!
      const recorded = recordedUnits(data, choice)!
      expect(played.units.some(([, unit]) => unit === phantimal)).toBe(true)
      expect(played.moved).not.toContain(phantimal)
      expect(played.moved.length).toBeLessThanOrEqual(1)
      expect(keepsUnmoved(recorded, played.units, played.moved)).toBe(true)
    }
  })
})

describe('a swap tried on a board', () => {
  const chosen = set
  const tryOn = (index: number, out: number[], into: number[]) => {
    const team = chosen.teams[index]!
    const { units } = formations[index]!
    return previewSwap(data, { board: boards[index]!, team, units, out, into })
  }

  it('keeps every unit when nothing changes', () => {
    chosen.teams.forEach((team, index) => {
      const hero = team.heroes[0]!
      expect(tryOn(index, [hero], [hero])).toMatchObject({ joined: [], left: [] })
    })
  })

  it('brings in the hero swapped in and takes out the one it replaces', () => {
    const index = chosen.teams.findIndex((team) => team.flex.length)
    const { out, options } = chosen.teams[index]!.flex[0]!
    const outTile = formations[index]!.units.find(([, unit]) => unit === out)![0]
    const preview = tryOn(index, [out], [options[0]!])
    expect(preview.joined.map(([, unit]) => unit)).toContain(options[0])
    expect(preview.left).toContain(outTile)
  })
})
