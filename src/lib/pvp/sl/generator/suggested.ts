/* The engine's formation for a chosen set's boards (lib/placement): each team's
 * heroes, the artifact the set gives it and the phantimal they can summon,
 * placed on its board's map from their skills, reading no recorded placement.
 * A file from another season than Stargazer's is placed as slTeamData draws it,
 * without its seasonal artifacts and phantimals. */

import { toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { placeTeam } from '@/lib/placement/engine'
import { explainPlacement, type PlacementExplanation } from '@/lib/placement/explain'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import type { PlacementData, PlacementTeam } from '@/lib/placement/types'
import { artifactSurvives, isRetiredSeason } from '@/lib/seasonal'
import { loadPhantimals } from '@/utils/dataLoader'
import type { SlData, SlUnit } from '../data/types'
import type { SlBoard } from './setType'
import type { SlChoice } from './types'

// Each of a season's phantimals needs three heroes of its own factions, so
// five heroes can summon one of them at most.
export function summonedPhantimal(data: SlData, heroes: number[]): number | undefined {
  if (isRetiredSeason(data.season)) return undefined
  const phantimal = loadPhantimals().find((p) =>
    lineupQualifies(p, heroes, PLACEMENT_LOOKUPS.factionOf),
  )
  return phantimal && toPhantimalId(phantimal.id)
}

// The engine's formation on one board: every unit and its tile, as a recorded
// placement's c and s hold them together, and why each stands there.
export interface SuggestedBoard {
  units: SlUnit[]
  why: PlacementExplanation
}

// A chosen team as the engine places it on a board: its heroes, the phantimal
// they summon and the artifact the set gives it.
export const boardTeam = (
  data: SlData,
  heroes: number[],
  artifact: number | null,
): PlacementTeam => ({
  heroes,
  phantimal: summonedPhantimal(data, heroes),
  artifact: artifact !== null && artifactSurvives(data.season, artifact) ? artifact : undefined,
})

// The engine's tuning on a board. A map with no games yet is expected to draw
// the enemy heroes of the map whose teams it takes.
export const boardPlacement = (data: SlData, { key, source }: SlBoard): PlacementData => ({
  ...data.placement,
  pickRates: { [key]: data.placement.pickRates[data.maps[source]!] ?? {} },
})

// One entry per board, in board order. A board whose teams were recorded on its
// map is left null unless `everyBoard`, and keeps the recorded formation.
export function suggestedBoards(
  data: SlData,
  set: SlChoice,
  boards: readonly SlBoard[],
  everyBoard: boolean,
): (SuggestedBoard | null)[] {
  return set.teams.map((choice, index) => {
    const board = boards[index]!
    if (board.recorded && !everyBoard) return null
    const { key } = board
    const team = boardTeam(data, choice.heroes, choice.artifact)
    const placement = boardPlacement(data, board)
    const placed = placeTeam(team, key, placement, PLACEMENT_LOOKUPS)
    return {
      units: placed.units.map((unit, i): SlUnit => [placed.positions[i]!, unit]),
      why: explainPlacement(team, key, placement, PLACEMENT_LOOKUPS, placed),
    }
  })
}
