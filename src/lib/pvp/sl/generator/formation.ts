/* A chosen set's boards as the page draws them, and why each unit stands where
 * it does (lib/placement). A board keeps its recorded placement, which the
 * engine reads with every unit held on its recorded tile, or takes the
 * engine's formation: each team's heroes, the artifact the set gives it and the
 * phantimal they can summon, placed on its board's map from their skills,
 * reading no recorded placement. A file from another season than Stargazer's
 * is placed as slTeamData draws it, without its seasonal artifacts and
 * phantimals. */

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
import { recordedUnits } from './team'
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

// One board as drawn: every unit and its tile, as a recorded placement's c and
// s hold them together, and why each stands there.
export interface BoardFormation {
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

// Units kept on their tiles, by unit id.
export const heldOn = (units: readonly SlUnit[]): Map<number, number> =>
  new Map(units.map(([hexId, unit]) => [unit, hexId]))

// One entry per board, in board order. A board whose teams were recorded on its
// map keeps the recorded placement unless `everyBoard`.
export function boardFormations(
  data: SlData,
  set: SlChoice,
  boards: readonly SlBoard[],
  everyBoard: boolean,
): BoardFormation[] {
  return set.teams.map((choice, index) => {
    const board = boards[index]!
    const { key } = board
    const team = boardTeam(data, choice.heroes, choice.artifact)
    const placement = boardPlacement(data, board)
    const recorded = board.recorded && !everyBoard ? recordedUnits(data, choice) : null
    const held = recorded ? { held: heldOn(recorded) } : {}
    const placed = placeTeam(team, key, placement, PLACEMENT_LOOKUPS, held)
    return {
      units: recorded ?? placed.units.map((unit, i): SlUnit => [placed.positions[i]!, unit]),
      why: explainPlacement(team, key, placement, PLACEMENT_LOOKUPS, placed),
    }
  })
}
