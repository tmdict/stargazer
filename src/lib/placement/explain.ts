/* Why a placement puts each unit where it stands, as the scorer values it.
 * Units are named by id and effects by the data file their rule sits in, so the
 * page words each reason in its own language. */

import { inPhantimalBand } from '../characters/phantimal'
import type { MapLayout } from '../maps'
import type { RuleGoal } from '../types/rule'
import { PlacementBoard } from './board'
import { asGoodAs, beats, EPS } from './engine'
import { ruleUnit } from './reach'
import { PlacementScorer, type OwnGoalCheck, type PlacementScore } from './score'
import type { FormationRule, PlacementData, PlacementLookups, PlacementTeam } from './types'

// One of the team's effects: the data file its rule sits in (the unit's, the
// charm's id or the artifact's), with -companion after a unit's for the effect
// its other body gives, and the unit giving it, the charm's holder for a charm
// and none for the artifact.
export interface PlacedEffect {
  source: OwnGoalCheck['source']
  file: string
  giver?: number
}

type Standing =
  | 'buff'
  | 'front'
  | 'back'
  | 'back-half'
  | 'frontmost'
  | 'front-two'
  | 'rearmost'
  | 'back-two'
  | 'in-front-of'
  | 'behind'
  | 'right-in-front-of'
  | 'right-behind'
  | 'next-to'
  | 'on-row'

// `to`: the units a given effect goes to.
export type PlacementReason =
  | { verb: 'gives' | 'reaches' | 'receives'; effect: PlacedEffect; to: number[] }
  | { verb: 'stands'; place: Standing; hero?: number }

export interface UnitPlacement {
  unit: number
  tile: number
  reasons: PlacementReason[]
  // The free tiles the engine would pick for the unit moved alone, as good as
  // where it stands or better.
  alsoFine: number[]
  better: number[]
}

export interface PlacementExplanation {
  // In the board's units' order.
  units: UnitPlacement[]
  artifact: PlacementReason[]
}

// How a unit's own effect reads: given to heroes, or reaching as much as it can
// or its own other body. A goal about enemy heroes explains nothing on our side.
function effectVerb(goal: RuleGoal): 'gives' | 'reaches' | undefined {
  if (goal === 'most' || goal === 'companion' || (typeof goal === 'object' && 'most' in goal))
    return 'reaches'
  if (typeof goal === 'object' && ('target' in goal || 'include' in goal || 'exactly' in goal))
    return 'gives'
  return undefined
}

const BACK_PLACES = new Set<Standing>(['back', 'rearmost', 'back-two'])

const RANKS: Partial<Record<FormationRule['relation'], Standing>> = {
  frontmost: 'frontmost',
  twoFrontmost: 'front-two',
  rearmost: 'rearmost',
  twoRearmost: 'back-two',
}

function habitOf({ relation, heroes: [a, b] }: FormationRule, hero: number): PlacementReason {
  const rank = RANKS[relation]
  if (rank) return { verb: 'stands', place: rank }
  const first = hero === a
  const other = first ? b! : a!
  switch (relation) {
    case 'inFrontOf':
      return { verb: 'stands', place: first ? 'in-front-of' : 'behind', hero: other }
    case 'behind':
      return { verb: 'stands', place: first ? 'right-in-front-of' : 'right-behind', hero: other }
    case 'nextTo':
      return { verb: 'stands', place: 'next-to', hero: other }
    default:
      return { verb: 'stands', place: 'on-row', hero: other }
  }
}

/**
 * The reasons for each unit's tile in a placement, and for the artifact's
 * effects. A unit's other tiles are measured against `best`, the best score
 * placeTeam found, or the placement's own where none is given.
 */
export function explainPlacement(
  team: PlacementTeam,
  layout: MapLayout,
  data: PlacementData,
  lookups: PlacementLookups,
  { positions, best }: { positions: number[]; best?: PlacementScore },
): PlacementExplanation {
  const board = new PlacementBoard(team, layout, lookups)
  // The enemy units' rules only choose among placements as good, so no tile is
  // taken for them.
  const scorer = new PlacementScorer(board, team, { ...data, pickRates: {} })
  const margin = data.weights.margin ?? 0
  board.place(positions)
  const base = best ?? scorer.score()

  const goals = scorer.ownGoals()
  const effects = goals.map((goal): PlacedEffect => {
    const file =
      typeof goal.owner === 'string' ? goal.owner : (lookups.nameOf(goal.owner) ?? `${goal.owner}`)
    return {
      source: goal.source,
      file: goal.rule.from === 'companion' ? `${file}-companion` : file,
      giver: goal.holder,
    }
  })
  const habits = scorer
    .formation()
    .filter(({ held }) => held)
    .map(({ rule }) => rule)
  const leans = new Map(team.heroes.map((hero) => [hero, scorer.leanOf(hero)]))
  const onBuff = new Set(board.units.filter((unit) => scorer.onBuffTile(unit)))
  const isOwn = (k: number, owner: number) =>
    goals[k]!.source !== 'artifact' && ruleUnit(goals[k]!.holder!) === owner

  // A unit's other tiles are those the engine itself would pick for it moved
  // alone, in the order it picks a placement by: fewest broken rules, goals
  // within the margin of the best, then the highest total, its lean included.
  const used = new Set(positions)
  const free = board.tiles.filter((hexId) => !used.has(hexId))
  const own = scorer.score()
  const movesFor = board.units.map((_, index) => {
    const options = free.map((hexId) => {
      const next = [...positions]
      next[index] = hexId
      board.place(next)
      return { hexId, score: scorer.score() }
    })
    const scores = [own, ...options.map(({ score }) => score)]
    const broken = Math.min(...scores.map((score) => score.broken))
    const top = {
      broken,
      goals: Math.max(
        ...scores.filter((score) => score.broken === broken).map((score) => score.goals),
      ),
      total: 0,
    }
    const total = Math.max(
      ...scores.filter((score) => asGoodAs(score, top, margin)).map((score) => score.total),
    )
    const picks = options.filter(
      ({ score }) => asGoodAs(score, top, margin) && score.total >= total - EPS,
    )
    return {
      better: picks.filter(({ score }) => beats(score, base, margin)).map(({ hexId }) => hexId),
      alsoFine: picks
        .filter(({ score }) => !beats(score, base, margin) && asGoodAs(score, base, margin))
        .map(({ hexId }) => hexId),
    }
  })
  board.place(positions)
  // A front or back line is true of the team: no hero or other body, the
  // phantimal left out, stands on a row ahead of the hero (behind, for the
  // back), nor nearer the enemy walking round the walls, as its lean is scored.
  const bodies = board.units.filter((unit) => !inPhantimalBand(unit))
  const measures = [
    (unit: number) => board.grid.getHexById(board.tileOf(unit)).getDiagonal(),
    (unit: number) => scorer.depth.get(board.tileOf(unit))!,
  ]
  const onEdge = (unit: number, lean: 'front' | 'back'): boolean =>
    measures.every((at) => {
      const all = bodies.map(at)
      return at(unit) === (lean === 'front' ? Math.max(...all) : Math.min(...all))
    })

  const units = board.units.map((unit, index): UnitPlacement => {
    const owner = ruleUnit(unit)
    const reasons: PlacementReason[] = []
    goals.forEach(({ rule, met, on, to }, k) => {
      const verb = effectVerb(rule.goal)
      if (!met || !verb || !isOwn(k, owner)) return
      if (verb === 'reaches') reasons.push({ verb, effect: effects[k]!, to: [] })
      else if (on.length) reasons.push({ verb, effect: effects[k]!, to })
    })
    goals.forEach(({ met, on }, k) => {
      if (met && on.includes(owner) && !isOwn(k, owner))
        reasons.push({ verb: 'receives', effect: effects[k]!, to: [] })
    })
    if (onBuff.has(unit)) reasons.push({ verb: 'stands', place: 'buff' })
    const kept = habits.filter((rule) => rule.heroes.includes(unit))
    for (const rule of kept) reasons.push(habitOf(rule, unit))
    const lean = leans.get(unit)
    if (lean && onEdge(unit, lean) && !kept.some((rule) => RANKS[rule.relation])) {
      reasons.push({ verb: 'stands', place: lean })
    }
    const backHalf = goals.some(
      ({ rule, met, holder }) => rule.goal === 'back' && met && holder === unit,
    )
    // A line saying the unit stands at the back, or among the rearmost, says
    // more than the back half.
    const atBack = reasons.some(
      (reason) => reason.verb === 'stands' && BACK_PLACES.has(reason.place),
    )
    if (backHalf && !atBack) reasons.push({ verb: 'stands', place: 'back-half' })
    return { unit, tile: positions[index]!, reasons, ...movesFor[index]! }
  })

  const artifact = goals.flatMap(({ source, rule, met, on, to }, k): PlacementReason[] =>
    source === 'artifact' && met && on.length && effectVerb(rule.goal) === 'gives'
      ? [{ verb: 'gives', effect: effects[k]!, to }]
      : [],
  )
  return { units, artifact }
}

// A unit with nothing to explain and no other tile to point at has no card.
export const hasCard = ({ reasons, alsoFine, better }: UnitPlacement): boolean =>
  reasons.length > 0 || alsoFine.length > 0 || better.length > 0

/**
 * The tiles a card rings: those of its unit, with its companions, and of the
 * units its reasons name, and whether it is the artifact's own card (no unit)
 * or names the artifact.
 */
export function cardRings(
  why: PlacementExplanation,
  reasons: readonly PlacementReason[],
  unit?: number,
): { own: Set<number>; named: Set<number>; artifact?: 'own' | 'named' } {
  const named = new Set<number>()
  let artifact = false
  for (const reason of reasons) {
    if (reason.verb === 'stands') {
      if (reason.hero !== undefined) named.add(reason.hero)
      continue
    }
    for (const to of reason.to) named.add(to)
    if (reason.verb === 'receives') {
      if (reason.effect.giver === undefined) artifact = true
      else named.add(reason.effect.giver)
    }
  }
  const tilesOf = (units: Set<number>) =>
    new Set(
      why.units
        .filter((entry) => units.has(entry.unit) || units.has(ruleUnit(entry.unit)))
        .map(({ tile }) => tile),
    )
  const own = unit === undefined ? undefined : ruleUnit(unit)
  return {
    own: tilesOf(new Set(own === undefined ? [] : [own])),
    named: tilesOf(named),
    artifact: own === undefined ? 'own' : artifact ? 'named' : undefined,
  }
}
