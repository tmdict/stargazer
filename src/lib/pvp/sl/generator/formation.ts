/* A chosen set's boards as the page draws them, and why each unit stands where
 * it does (lib/placement). A board whose team was recorded on its map draws
 * that game's formation, which the engine reads with every unit held on its
 * recorded tile, and every board can draw the engine's formation: the team's
 * heroes, the artifact the set gives it and the phantimal they can summon,
 * placed on the board's map from their skills, reading no recorded placement.
 * A file from another season than Stargazer's is placed as slTeamData draws
 * it, without its seasonal artifacts and phantimals. */

import { toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { PlacementBoard } from '@/lib/placement/board'
import { placeTeam, type PlacementResult } from '@/lib/placement/engine'
import { explainPlacement, type PlacementExplanation } from '@/lib/placement/explain'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { ruleUnit } from '@/lib/placement/reach'
import { PlacementScorer } from '@/lib/placement/score'
import type { PlacementData, PlacementTeam } from '@/lib/placement/types'
import { artifactSurvives, isRetiredSeason } from '@/lib/seasonal'
import { loadPhantimals } from '@/utils/dataLoader'
import type { SlData, SlUnit } from '../data/types'
import type { SlBoard } from './setType'
import { recordedUnits } from './team'
import type { SlChoice, SlChoiceTeam } from './types'

const EPS = 1e-9

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

// A recorded game's formation as drawn, with the units the engine moved in it
// for the phantimal's Spirit Mark, the phantimal first; none when it is drawn
// as recorded.
export interface PlayedFormation extends BoardFormation {
  moved: number[]
}

// A board's two formations: the recorded game's, where its team was recorded
// on its map, and the engine's. The engine's is null where the board has a
// recorded game's formation until it is asked for (engineFormation).
export interface BoardDraw {
  played: PlayedFormation | null
  engine: BoardFormation | null
}

// The formation a board shows: the engine's when asked for and worked out,
// else the recorded game's where there is one.
export const shownFormation = (draw: BoardDraw, engine: boolean): BoardFormation =>
  (engine && draw.engine) || draw.played || draw.engine!

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

const unitsOf = ({ units, positions }: PlacementResult): SlUnit[] =>
  units.map((unit, i): SlUnit => [positions[i]!, unit])

// How much of the phantimal's goals a placement meets, its Spirit Mark's: null
// when the team cannot meet them.
function phantimalGoals(
  team: PlacementTeam,
  mapKey: string,
  placement: PlacementData,
): (positions: number[]) => number | null {
  const board = new PlacementBoard(team, mapKey, PLACEMENT_LOOKUPS)
  const scorer = new PlacementScorer(board, team, placement)
  return (positions) => {
    board.place(positions)
    const met = scorer
      .ownGoals()
      .filter(
        ({ source, owner }) => source === 'unit' && ruleUnit(owner as number) === team.phantimal,
      )
      .map((goal) => goal.met)
    return met.some((m) => m !== null) ? met.reduce<number>((sum, m) => sum + (m ?? 0), 0) : null
  }
}

/**
 * The recorded game's formation of a board, null when its team was not
 * recorded on the board's map. Where the phantimal's Spirit Mark lands better
 * with the phantimal moved, or the phantimal and one hero, the engine moves
 * them and keeps every other unit on its recorded tile; fewer units moved wins
 * a tie.
 */
export function playedFormation(
  data: SlData,
  choice: SlChoiceTeam,
  board: SlBoard,
): PlayedFormation | null {
  const recorded = board.recorded ? recordedUnits(data, choice) : null
  if (!recorded) return null
  const team = boardTeam(data, choice.heroes, choice.artifact)
  const placement = boardPlacement(data, board)
  const held = heldOn(recorded)
  const place = (keep: ReadonlyMap<number, number>) =>
    placeTeam(team, board.key, placement, PLACEMENT_LOOKUPS, { held: keep })
  const asRecorded = place(held)
  const explained = (placed: PlacementResult) =>
    explainPlacement(team, board.key, placement, PLACEMENT_LOOKUPS, placed)
  const { phantimal } = team
  if (phantimal === undefined) return { units: recorded, why: explained(asRecorded), moved: [] }

  const goalsAt = phantimalGoals(team, board.key, placement)
  let best = goalsAt(asRecorded.positions)
  let picked = asRecorded
  if (best !== null) {
    for (const free of [[phantimal], ...team.heroes.map((hero) => [phantimal, hero])]) {
      const tried = place(new Map([...held].filter(([unit]) => !free.includes(ruleUnit(unit)))))
      const met = goalsAt(tried.positions)!
      if (met > best + EPS) {
        best = met
        picked = tried
      }
    }
  }
  if (picked === asRecorded) return { units: recorded, why: explained(asRecorded), moved: [] }
  const units = unitsOf(picked)
  const moved = [
    ...new Set(
      units.flatMap(([hexId, unit]) => (held.get(unit) === hexId ? [] : [ruleUnit(unit)])),
    ),
  ].sort((a, b) => Number(b === phantimal) - Number(a === phantimal))
  return { units, why: explained(picked), moved }
}

// The engine's formation of a board, read from no recorded placement.
export function engineFormation(
  data: SlData,
  choice: SlChoiceTeam,
  board: SlBoard,
): BoardFormation {
  const team = boardTeam(data, choice.heroes, choice.artifact)
  const placement = boardPlacement(data, board)
  const placed = placeTeam(team, board.key, placement, PLACEMENT_LOOKUPS)
  return {
    units: unitsOf(placed),
    why: explainPlacement(team, board.key, placement, PLACEMENT_LOOKUPS, placed),
  }
}

// One entry per board, in board order: the recorded game's formation where
// there is one, the engine's elsewhere.
export function boardDraws(data: SlData, set: SlChoice, boards: readonly SlBoard[]): BoardDraw[] {
  return set.teams.map((choice, index) => {
    const board = boards[index]!
    const played = playedFormation(data, choice, board)
    return { played, engine: played ? null : engineFormation(data, choice, board) }
  })
}
