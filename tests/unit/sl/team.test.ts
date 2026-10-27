import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { loadSlData } from '@/lib/pvp/sl/data/codec'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import { slTeamData } from '@/lib/pvp/sl/generator/team'
import type { SlChoice, SlPick } from '@/lib/pvp/sl/generator/types'
import { learnSeason } from '@/lib/pvp/sl/model/models'
import { CURRENT_SEASON, isPermanentArtifactId } from '@/lib/seasonal'
import { Team } from '@/lib/types/team'
import { loadCharacters } from '@/utils/dataLoader'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'

// The page fetches the file the build emits, so the test serves it the same bytes.
vi.stubGlobal(
  'fetch',
  async () =>
    new Response(readFileSync(new URL('../../../src/content/pvp/sl/sl.bin', import.meta.url))),
)
const data = await loadSlData()
vi.unstubAllGlobals()
const learned = learnSeason(data)
const faction = new Map(loadCharacters().map((c) => [c.id, c.faction]))
const picks: SlPick[] = [...new Set(data.teams.flatMap((t) => t.heroes))].map((id, i) => ({
  id,
  faction: faction.get(id)!,
  paragon: i % 5,
  refinement: 4,
}))
const set = chooseSlSet(data, learned, picks)!
const byTile = (a: number[], b: number[]) => a[0]! - b[0]!
const decoded = (season: number) =>
  decodeMultiGridStateFromUrl(slTeamData({ ...data, season }, set, picks))!

// Each board of a saved set against the team it came from, in that team's
// season.
const expectSaved = (chosen: SlChoice, chosenWith: SlPick[]) => {
  const state = decodeMultiGridStateFromUrl(slTeamData(data, chosen, chosenWith))!
  expect(state.mode).toBe('5v5')
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

  // A selection with no Celestial or Hypogean hero takes last season's teams too.
  it.skipIf(!data.before)("saves last season's teams the same way", () => {
    const fewer: SlPick[] = [
      ...new Set([...data.teams, ...data.before!.teams].flatMap((t) => t.heroes)),
    ]
      .filter((id) => !['celestial', 'hypogean'].includes(faction.get(id)!))
      .map((id) => ({ id, faction: faction.get(id)!, paragon: 4, refinement: 4 }))
    const chosen = chooseSlSet(data, learned, fewer)!
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
