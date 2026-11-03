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

// One entry per board, in board order. A board whose teams were recorded on its
// map is left null unless `everyBoard`, and keeps the recorded formation.
export function suggestedBoards(
  data: SlData,
  set: SlChoice,
  boards: readonly SlBoard[],
  everyBoard: boolean,
): (SuggestedBoard | null)[] {
  const { pickRates } = data.placement
  return set.teams.map((choice, index) => {
    const { key, source, recorded } = boards[index]!
    if (recorded && !everyBoard) return null
    const { artifact } = choice
    const team = {
      heroes: choice.heroes,
      phantimal: summonedPhantimal(data, choice.heroes),
      artifact: artifact !== null && artifactSurvives(data.season, artifact) ? artifact : undefined,
    }
    // A map with no games yet is expected to draw the enemy heroes of the map
    // whose teams it takes.
    const placement = {
      ...data.placement,
      pickRates: { [key]: pickRates[data.maps[source]!] ?? {} },
    }
    const placed = placeTeam(team, key, placement, PLACEMENT_LOOKUPS)
    return {
      units: placed.units.map((unit, i): SlUnit => [placed.positions[i]!, unit]),
      why: explainPlacement(team, key, placement, PLACEMENT_LOOKUPS, placed),
    }
  })
}
