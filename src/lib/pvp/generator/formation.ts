/* A chosen set's boards as the page draws them, and why each unit stands where
 * it does (lib/placement). A board whose team was recorded on its map has two
 * formations, that game's and the engine's, and shows the one a comparison
 * picks: the recorded one where the rules score it about as high as the
 * engine's, or where its own win record makes up the difference. A formation
 * recorded only in events played without Spirit Marks has its phantimal, and
 * at most one hero, moved for the mark before it is scored; a board of an
 * earlier season recorded no phantimal, so the engine places the one its
 * heroes summon. The engine's formation is the team's heroes, the artifact the
 * set gives it and the phantimal they can summon, placed on the board's map
 * from their skills, reading no recorded placement. A file from another season
 * than Stargazer's is placed as slTeamData draws it, without its seasonal
 * artifacts and phantimals. A board of the Non-Seasonal format fields no
 * phantimal, so both its formations are the heroes' alone, compared the same
 * way. A side placed by hand on the Arena or Teams is explained where it
 * stands (Placement tips). */

import { isBaseHeroId } from '@/lib/characters/character'
import { inPhantimalBand, isPhantimalId } from '@/lib/characters/phantimal'
import type { MapLayout } from '@/lib/maps'
import { PlacementBoard } from '@/lib/placement/board'
import { asGoodAs, EPS, placeTeam, type PlacementResult } from '@/lib/placement/engine'
import { explainPlacement, type PlacementExplanation } from '@/lib/placement/explain'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { ruleUnit } from '@/lib/placement/reach'
import { PlacementScorer, type PlacementScore } from '@/lib/placement/score'
import type { PlacementData, PlacementTeam } from '@/lib/placement/types'
import { artifactSurvives, isRetiredSeason } from '@/lib/seasonal'
import type { SlData, SlUnit } from '../data/types'
import { summonedPhantimal } from './fit'
import type { SlBoard } from './setType'
import { homeMap, recordedPlacement, recordedUnits } from './team'
import type { SlChoice, SlChoiceTeam } from './types'

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

// What the comparison weighed, in rule points: the recorded formation's score,
// the points its win record adds, and the engine's formation's score.
export interface FormationScores {
  played: number
  bonus: number
  engine: number
}

// A board's formations: the engine's, and the recorded game's where its team
// was recorded on its map, with the comparison's numbers and whether the
// recorded one is the board's.
export interface BoardDraw {
  played: PlayedFormation | null
  engine: BoardFormation
  scores: FormationScores | null
  showsPlayed: boolean
}

// The formation a board shows: the comparison's, unless `engineOn` says which.
export const shownFormation = (draw: BoardDraw, engineOn?: boolean): BoardFormation =>
  (engineOn ?? !draw.showsPlayed) || !draw.played ? draw.engine : draw.played

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
export const placementDataFor = (
  data: SlData,
  { layout, source }: SlBoard,
  choice: Pick<SlChoiceTeam, 'source' | 'team'>,
): PlacementData => {
  const from = source ?? homeMap(data, choice)
  return { ...data.placement, pickRates: { [layout.key]: data.maps[from]!.pickRates } }
}

// The name external tooling calls placementDataFor by.
export const boardPlacement = placementDataFor

// Units kept on their tiles, by unit id.
export const heldOn = (units: readonly SlUnit[]): Map<number, number> =>
  new Map(units.map(([hexId, unit]) => [unit, hexId]))

const unitsOf = ({ units, positions }: PlacementResult): SlUnit[] =>
  units.map((unit, i): SlUnit => [positions[i]!, unit])

// A team's board to score placements on: the score of one, and how much of the
// phantimal's goals, its Spirit Marks', it meets, null when the team cannot
// meet them.
function boardScores(team: PlacementTeam, layout: MapLayout, placement: PlacementData) {
  const board = new PlacementBoard(team, layout, PLACEMENT_LOOKUPS)
  const scorer = new PlacementScorer(board, team, placement)
  return {
    score: (positions: number[]): PlacementScore => {
      board.place(positions)
      return scorer.score()
    },
    marks: (positions: number[]): number | null => {
      board.place(positions)
      const met = scorer
        .ownGoals()
        .filter(
          ({ source, owner }) => source === 'unit' && ruleUnit(owner as number) === team.phantimal,
        )
        .map((goal) => goal.met)
      return met.some((m) => m !== null) ? met.reduce<number>((sum, m) => sum + (m ?? 0), 0) : null
    },
  }
}

/**
 * The recorded formation of a board as placed, null when the board has no
 * recorded formation of its team. One recorded only without Spirit Marks has
 * the phantimal moved, or the phantimal and one hero, where the mark lands
 * better so, every other unit kept on its recorded tile; of the tries that
 * land it best, the one moving the fewest units wins.
 */
function playedPlacement(
  data: SlData,
  choice: SlChoiceTeam,
  board: SlBoard,
  team: PlacementTeam,
  placement: PlacementData,
  marksAt: (positions: number[]) => number | null,
): { placed: PlacementResult; units: SlUnit[]; moved: number[] } | null {
  const units = choice.source === board.source ? recordedUnits(data, choice) : null
  if (!units) return null
  const { phantimal } = team
  const recorded =
    phantimal === undefined ? units.filter(([, unit]) => !inPhantimalBand(unit)) : units
  const held = heldOn(recorded)
  const place = (keep: ReadonlyMap<number, number>) =>
    placeTeam(team, board.layout, placement, PLACEMENT_LOOKUPS, { held: keep })
  const asRecorded = place(held)
  const asIs = {
    placed: asRecorded,
    units: asRecorded.units.every((unit) => held.has(unit)) ? recorded : unitsOf(asRecorded),
    moved: [],
  }
  if (phantimal === undefined || !recordedPlacement(data, choice)!.a) return asIs
  const recordedMet = marksAt(asRecorded.positions)
  if (recordedMet === null) return asIs

  let best: { placed: PlacementResult; met: number; moved: number[] } | undefined
  for (const free of [[phantimal], ...team.heroes.map((hero) => [phantimal, hero])]) {
    const placed = place(new Map([...held].filter(([unit]) => !free.includes(ruleUnit(unit)))))
    const met = marksAt(placed.positions)!
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
  if (!best) return asIs
  return {
    placed: best.placed,
    units: unitsOf(best.placed),
    moved: best.moved.sort((a, b) => Number(b === phantimal) - Number(a === phantimal)),
  }
}

// A board's two formations and which it shows. The recorded one is the board's
// when its score is within the margin of the engine's, or when its share of
// the engine's score and its record's bonus together reach the whole. One that
// keeps fewer hard rules than the engine's is never the board's.
export function boardDraw(
  data: SlData,
  choice: SlChoiceTeam,
  board: SlBoard,
  nonSeasonal = false,
): BoardDraw {
  const seasonal = boardTeam(data, choice.heroes, choice.artifact)
  const team = nonSeasonal ? { ...seasonal, phantimal: undefined } : seasonal
  const placement = placementDataFor(data, board, choice)
  const explained = (placed: PlacementResult) =>
    explainPlacement(team, board.layout, placement, PLACEMENT_LOOKUPS, placed)
  const placed = placeTeam(team, board.layout, placement, PLACEMENT_LOOKUPS)
  const engine = { units: unitsOf(placed), why: explained(placed) }
  const scoresAt = boardScores(team, board.layout, placement)
  const played = playedPlacement(data, choice, board, team, placement, scoresAt.marks)
  if (!played) return { played: null, engine, scores: null, showsPlayed: false }

  const engineScore = scoresAt.score(placed.positions)
  const playedScore = scoresAt.score(played.placed.positions)
  const bonus = (recordedPlacement(data, choice)!.b ?? 0) * Math.max(0, engineScore.goals)
  const margin = placement.weights.margin ?? 0
  return {
    played: { units: played.units, why: explained(played.placed), moved: played.moved },
    engine,
    scores: { played: playedScore.goals, bonus, engine: engineScore.goals },
    showsPlayed:
      asGoodAs(playedScore, engineScore, margin) ||
      asGoodAs({ ...playedScore, goals: playedScore.goals + bonus }, engineScore, 0),
  }
}

export const boardDraws = (
  data: SlData,
  set: SlChoice,
  boards: readonly SlBoard[],
  nonSeasonal = false,
): BoardDraw[] =>
  set.teams.map((choice, index) => boardDraw(data, choice, boards[index]!, nonSeasonal))

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
