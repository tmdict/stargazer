/* Why a placement puts each unit where it stands, as the scorer values it: the
 * effects a unit gives, reaches or receives, the effects of others that a move
 * to a worse tile would cost, the buff tile, the rules found in the formations
 * it keeps and the side its hero leans to, and the free tiles it could take
 * alone with a placement as good. Units are named by id and effects by the data
 * file their rule sits in, so the page words each reason in its own language. */

import type { RuleGoal } from '../types/rule'
import { PlacementBoard } from './board'
import { asGoodAs, type PlacementResult } from './engine'
import { ruleUnit } from './reach'
import { PlacementScorer, type OwnGoalCheck } from './score'
import type { FormationRule, PlacementData, PlacementLookups, PlacementTeam } from './types'

// One of the team's effects: the data file its rule sits in (the unit's, the
// charm's id or the artifact's) and the unit giving it, the charm's holder for
// a charm and none for the artifact.
export interface PlacedEffect {
  source: OwnGoalCheck['source']
  file: string
  giver?: number
}

type Standing =
  | 'buff'
  | 'front'
  | 'back'
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
  | 'free'

// `heroes`: those a given effect goes to, or those a kept effect stays on.
export type PlacementReason =
  | { verb: 'gives' | 'reaches' | 'receives' | 'keeps'; effect: PlacedEffect; heroes: number[] }
  | { verb: 'stands'; place: Standing; hero?: number }

export interface UnitPlacement {
  unit: number
  tile: number
  reasons: PlacementReason[]
  // The free tiles the unit could move to alone with a placement as good.
  alsoFine: number[]
}

export interface PlacementExplanation {
  // In the board's units' order.
  units: UnitPlacement[]
  artifact: PlacementReason[]
}

// How a unit's own effect reads: given to heroes, or reaching as much as it can.
// A goal about enemy heroes explains nothing on our side.
export function effectVerb(goal: RuleGoal): 'gives' | 'reaches' | undefined {
  if (goal === 'most' || (typeof goal === 'object' && 'most' in goal)) return 'reaches'
  if (typeof goal === 'object' && ('target' in goal || 'include' in goal || 'exactly' in goal))
    return 'gives'
  return undefined
}

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
 * The reasons for each unit's tile in a placement placeTeam picked, and for the
 * artifact's effects.
 */
export function explainPlacement(
  team: PlacementTeam,
  mapKey: string,
  data: PlacementData,
  lookups: PlacementLookups,
  { positions, best }: Pick<PlacementResult, 'positions' | 'best'>,
): PlacementExplanation {
  const board = new PlacementBoard(team, mapKey, lookups)
  // The enemy units' rules only choose among placements as good, so no tile is
  // taken for them.
  const scorer = new PlacementScorer(board, team, { ...data, pickRates: {} })
  const margin = data.weights.margin ?? 0
  board.place(positions)

  const goals = scorer.ownGoals()
  const effects = goals.map((goal): PlacedEffect => ({
    source: goal.source,
    file:
      typeof goal.owner === 'string' ? goal.owner : (lookups.nameOf(goal.owner) ?? `${goal.owner}`),
    giver: goal.holder,
  }))
  const habits = scorer
    .formation()
    .filter(({ held }) => held)
    .map(({ rule }) => rule)
  const leans = new Map(team.heroes.map((hero) => [hero, scorer.leanHeld(hero)]))
  const onBuff = new Set(board.units.filter((unit) => scorer.onBuffTile(unit)))
  const isOwn = (k: number, owner: number) =>
    goals[k]!.source !== 'artifact' && ruleUnit(goals[k]!.holder!) === owner

  const used = new Set(positions)
  const free = board.tiles.filter((hexId) => !used.has(hexId))
  // Each unit moved alone to every free tile: the tiles as good, and the goals
  // that every move to another tile lowers.
  const moves = board.units.map((_, index) => {
    const alsoFine: number[] = []
    let lowered: number[] | undefined
    for (const hexId of free) {
      const next = [...positions]
      next[index] = hexId
      board.place(next)
      if (asGoodAs(scorer.score(), best, margin)) {
        alsoFine.push(hexId)
        continue
      }
      const after = scorer.ownGoals()
      const here = goals.flatMap(({ met }, k) => ((after[k]!.met ?? 0) < (met ?? 0) ? [k] : []))
      lowered = lowered ? lowered.filter((k) => here.includes(k)) : here
    }
    return { alsoFine, lowered: new Set(lowered) }
  })
  board.place(positions)

  const units = board.units.map((unit, index): UnitPlacement => {
    const owner = ruleUnit(unit)
    const { alsoFine, lowered } = moves[index]!
    const reasons: PlacementReason[] = []
    goals.forEach(({ rule, met, on }, k) => {
      const verb = effectVerb(rule.goal)
      if (!met || !verb || !isOwn(k, owner)) return
      if (verb === 'reaches') reasons.push({ verb, effect: effects[k]!, heroes: [] })
      else if (on.length) reasons.push({ verb, effect: effects[k]!, heroes: on })
    })
    goals.forEach(({ met, on }, k) => {
      if (met && on.includes(owner) && !isOwn(k, owner))
        reasons.push({ verb: 'receives', effect: effects[k]!, heroes: [] })
    })
    goals.forEach(({ on }, k) => {
      if (lowered.has(k) && on.length && !on.includes(owner) && !isOwn(k, owner))
        reasons.push({ verb: 'keeps', effect: effects[k]!, heroes: on })
    })
    if (onBuff.has(unit)) reasons.push({ verb: 'stands', place: 'buff' })
    const own = habits.filter((rule) => rule.heroes.includes(unit))
    for (const rule of own) reasons.push(habitOf(rule, unit))
    const lean = leans.get(unit)
    if (lean && !own.some((rule) => RANKS[rule.relation])) {
      reasons.push({ verb: 'stands', place: lean })
    }
    if (!reasons.length && free.length && alsoFine.length === free.length) {
      reasons.push({ verb: 'stands', place: 'free' })
    }
    return { unit, tile: positions[index]!, reasons, alsoFine }
  })

  const artifact = goals.flatMap(({ source, rule, met, on }, k): PlacementReason[] =>
    source === 'artifact' && met && on.length && effectVerb(rule.goal) === 'gives'
      ? [{ verb: 'gives', effect: effects[k]!, heroes: on }]
      : [],
  )
  return { units, artifact }
}
