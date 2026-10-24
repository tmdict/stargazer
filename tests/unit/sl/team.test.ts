import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { chooseSlSet } from '@/lib/pvp/sl/chooser'
import { decodeSlData } from '@/lib/pvp/sl/codec'
import { slTeamData } from '@/lib/pvp/sl/team'
import type { SlPick } from '@/lib/pvp/sl/types'
import { CURRENT_SEASON, isPermanentArtifactId } from '@/lib/seasonal'
import { Team } from '@/lib/types/team'
import { loadCharacters } from '@/utils/dataLoader'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'

const data = await decodeSlData(
  new Uint8Array(readFileSync(new URL('../../../src/content/pvp/sl/sl.bin', import.meta.url))),
)
const faction = new Map(loadCharacters().map((c) => [c.id, c.faction]))
const picks: SlPick[] = [...new Set(data.teams.flatMap((t) => t.heroes))].map((id, i) => ({
  id,
  faction: faction.get(id)!,
  paragon: i % 5,
  refinement: 4,
}))
const set = chooseSlSet(data, picks)!
const byTile = (a: number[], b: number[]) => a[0]! - b[0]!
const decoded = (season: number) =>
  decodeMultiGridStateFromUrl(slTeamData({ ...data, season }, set, picks))!

describe('a set saved as a team', () => {
  it('puts each team on its map with its units, artifact, phantimal and the levels chosen with', () => {
    const state = decoded(data.season)
    expect(state.mode).toBe('5v5')
    expect(state.season).toBe(CURRENT_SEASON)
    state.boards.forEach((board, i) => {
      const choice = set.teams[i]!
      const team = data.teams[choice.team]!
      const placement = team.placements[choice.placement]!
      expect(board.m).toBe(data.maps[team.map]!.key)
      expect([...(board.c ?? [])].sort(byTile)).toEqual(
        placement.c.map(([tile, id]) => [tile, id, Team.ALLY]).sort(byTile),
      )
      expect(board.s ?? []).toEqual(placement.s.map(([tile, id]) => [tile, id, Team.ALLY]))
      expect(board.a?.[0] ?? null).toBe(choice.artifact)
      const levels = (id: number) => picks.find((p) => p.id === id)!
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
