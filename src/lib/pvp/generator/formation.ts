/* A chosen set's boards as the page draws them, and why each unit stands where
 * it does (lib/placement). A board whose team was recorded on its map draws
 * that game's formation, with at most its phantimal and one hero moved for the
 * Spirit Mark outside Supreme League, which plays without the marks; a board of
 * an earlier season recorded no phantimal, so the engine places the one its
 * heroes summon. Every board can draw the engine's formation: the team's
 * heroes, the artifact the set gives it and the phantimal they can summon,
 * placed on the board's map from their skills, reading no recorded placement.
 * A file from another season than Stargazer's is placed as slTeamData draws
 * it, without its seasonal artifacts and phantimals. A side placed by hand on
 * the Arena or Teams is explained where it stands (Placement tips). */

import { isBaseHeroId } from '@/lib/characters/character'
import { isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import type { MapLayout } from '@/lib/maps'
import { PlacementBoard } from '@/lib/placement/board'
import { EPS, placeTeam, type PlacementResult } from '@/lib/placement/engine'
import { explainPlacement, type PlacementExplanation } from '@/lib/placement/explain'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { ruleUnit } from '@/lib/placement/reach'
import { PlacementScorer } from '@/lib/placement/score'
import type { PlacementData, PlacementTeam } from '@/lib/placement/types'
import { artifactSurvives, isRetiredSeason } from '@/lib/seasonal'
import { matchVariant } from '@/lib/teams/modes'
import { loadPhantimals } from '@/utils/dataLoader'
import type { SlData, SlUnit } from '../data/types'
import type { SlBoard } from './setType'
import { homeMap, recordedUnits } from './team'
import type { SlChoice, SlChoiceTeam } from './types'

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
// as recorded. A phantimal the game did not record is placed, not moved.
interface PlayedFormation extends BoardFormation {
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
export const shownFormation = (draw: BoardDraw, engineOn: boolean): BoardFormation =>
  (engineOn && draw.engine) || draw.played || draw.engine!

export const boardTeam = (
  data: SlData,
  heroes: number[],
  artifact: number | null,
): PlacementTeam => ({
  heroes,
  phantimal: summonedPhantimal(data, heroes),
  artifact: artifact !== null && artifactSurvives(data.season, artifact) ? artifact : undefined,
})

// A map with no records is expected to draw the enemy heroes of the map the
// team was recorded on.
export const boardPlacement = (
  data: SlData,
  { layout, source }: SlBoard,
  choice: Pick<SlChoiceTeam, 'source' | 'team'>,
): PlacementData => {
  const from = source ?? homeMap(data, choice)
  return { ...data.placement, pickRates: { [layout.key]: data.maps[from]!.pickRates } }
}

// Units kept on their tiles, by unit id.
export const heldOn = (units: readonly SlUnit[]): Map<number, number> =>
  new Map(units.map(([hexId, unit]) => [unit, hexId]))

const unitsOf = ({ units, positions }: PlacementResult): SlUnit[] =>
  units.map((unit, i): SlUnit => [positions[i]!, unit])

// How much of the phantimal's goals a placement meets, its Spirit Mark's: null
// when the team cannot meet them.
function phantimalGoals(
  team: PlacementTeam,
  layout: MapLayout,
  placement: PlacementData,
): (positions: number[]) => number | null {
  const board = new PlacementBoard(team, layout, PLACEMENT_LOOKUPS)
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

// Supreme League plays without Spirit Marks, so a set on its maps keeps every
// recorded formation as recorded. Guild Duel shares two of its maps, so the
// whole set decides, not a board's map.
export const marksCount = (boards: readonly SlBoard[]): boolean =>
  matchVariant(
    '5v5',
    boards.map((board) => board.layout.key),
  ) !== 'sl'

/**
 * The recorded game's formation of a board, null when the board has no
 * recorded formation of its team. Where the marks count and the phantimal's
 * Spirit Mark lands better with the phantimal moved, or the phantimal and one
 * hero, the engine moves them and keeps every other unit on its recorded tile;
 * of the tries that land it best, the one moving the fewest units wins.
 */
function playedFormation(
  data: SlData,
  choice: SlChoiceTeam,
  board: SlBoard,
  marks: boolean,
): PlayedFormation | null {
  const recorded = choice.source === board.source ? recordedUnits(data, choice) : null
  if (!recorded) return null
  const team = boardTeam(data, choice.heroes, choice.artifact)
  const placement = boardPlacement(data, board, choice)
  const held = heldOn(recorded)
  const place = (keep: ReadonlyMap<number, number>) =>
    placeTeam(team, board.layout, placement, PLACEMENT_LOOKUPS, { held: keep })
  const asRecorded = place(held)
  const explained = (placed: PlacementResult) =>
    explainPlacement(team, board.layout, placement, PLACEMENT_LOOKUPS, placed)
  const asIs = (): PlayedFormation => ({
    units: asRecorded.units.every((unit) => held.has(unit)) ? recorded : unitsOf(asRecorded),
    why: explained(asRecorded),
    moved: [],
  })
  const { phantimal } = team
  if (phantimal === undefined || !marks) return asIs()
  const goalsAt = phantimalGoals(team, board.layout, placement)
  const recordedMet = goalsAt(asRecorded.positions)
  if (recordedMet === null) return asIs()

  let best: { placed: PlacementResult; met: number; moved: number[] } | undefined
  for (const free of [[phantimal], ...team.heroes.map((hero) => [phantimal, hero])]) {
    const placed = place(new Map([...held].filter(([unit]) => !free.includes(ruleUnit(unit)))))
    const met = goalsAt(placed.positions)!
    if (met <= recordedMet + EPS) continue
    // A freed unit can land back on its recorded tile, so a try is ranked by
    // the units it moved, not the ones it freed.
    const moved = [
      ...new Set(
        unitsOf(placed).flatMap(([hexId, unit]) =>
          held.has(unit) && held.get(unit) !== hexId ? [ruleUnit(unit)] : [],
        ),
      ),
    ]
    const tie = best && Math.abs(met - best.met) <= EPS
    if (!best || met > best.met + EPS || (tie && moved.length < best.moved.length)) {
      best = { placed, met, moved }
    }
  }
  if (!best) return asIs()
  return {
    units: unitsOf(best.placed),
    why: explained(best.placed),
    moved: best.moved.sort((a, b) => Number(b === phantimal) - Number(a === phantimal)),
  }
}

// The engine's formation of a board, read from no recorded placement.
export function engineFormation(
  data: SlData,
  choice: SlChoiceTeam,
  board: SlBoard,
): BoardFormation {
  const team = boardTeam(data, choice.heroes, choice.artifact)
  const placement = boardPlacement(data, board, choice)
  const placed = placeTeam(team, board.layout, placement, PLACEMENT_LOOKUPS)
  return {
    units: unitsOf(placed),
    why: explainPlacement(team, board.layout, placement, PLACEMENT_LOOKUPS, placed),
  }
}

// The recorded game's formation where there is one, the engine's elsewhere;
// `marks` is marksCount of the whole set's boards.
export function boardDraw(
  data: SlData,
  choice: SlChoiceTeam,
  board: SlBoard,
  marks: boolean,
): BoardDraw {
  const played = playedFormation(data, choice, board, marks)
  return { played, engine: played ? null : engineFormation(data, choice, board) }
}

// One entry per board, in board order.
export function boardDraws(data: SlData, set: SlChoice, boards: readonly SlBoard[]): BoardDraw[] {
  const marks = marksCount(boards)
  return set.teams.map((choice, index) => boardDraw(data, choice, boards[index]!, marks))
}

/**
 * Why each unit of a side stands where it does, measured against where it
 * stands; null for a side the engine would place otherwise, such as one with a
 * synergy hero or a unit its skills would not spawn.
 */
export function sideExplanation(
  data: SlData,
  layout: MapLayout,
  units: readonly SlUnit[],
  artifact: number | null,
): PlacementExplanation | null {
  const ids = units.map(([, unit]) => unit)
  const team = {
    ...boardTeam(data, ids.filter(isBaseHeroId), artifact),
    phantimal: isRetiredSeason(data.season) ? undefined : ids.find(isPhantimalId),
  }
  let board: PlacementBoard
  try {
    board = new PlacementBoard(team, layout, PLACEMENT_LOOKUPS)
  } catch {
    return null
  }
  const held = heldOn(units)
  if (board.units.length !== units.length || board.units.some((unit) => !held.has(unit))) {
    return null
  }
  const positions = board.units.map((unit) => held.get(unit)!)
  return explainPlacement(team, layout, { ...data.placement, pickRates: {} }, PLACEMENT_LOOKUPS, {
    positions,
  })
}
