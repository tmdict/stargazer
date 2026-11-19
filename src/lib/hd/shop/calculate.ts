// One press of Calculate: every goal the wanted items make, with both answers
// for each and what to keep when the advice is to stop.
//
// The answers come in stages. The first has every row at once, a chance being a
// range where the tables alone do not settle it. The search then narrows the
// ranges that decide what a goal shows, one goal at a time, until none is left
// or its time is up; a range not reached by then stays a range.
//
// The work also pauses between stages, where whoever runs it can end it: after
// each goal is prepared, after each goal's first answer, and after each slice
// of search. Everything worked out up to a pause is in the cache, so ending
// there loses nothing.

import {
  adviseBadges,
  adviseChance,
  keepsLocks,
  sameMove,
  type BadgeAdvice,
  type ChanceAdvice,
  type ChanceRow,
} from './advice'
import { solveMaxChance, type MaxChance } from './maxChance'
import { solveMinBadges } from './minBadges'
import { firstMoves, goalModel, type GoalModel } from './moves'
import {
  SHOWS_AS_ZERO,
  solveNextRound,
  stopReason,
  type StopPlan,
  type StopReason,
} from './nextRound'
import { SOURCES } from './odds'
import { solveOffers, type Offers } from './offers'
import { OutOfTime } from './search'
import type { SolverCache } from './solverCache'
import { readShop, type ShopReading } from './sources'
import type {
  EnteredShop,
  Goal,
  LevelOdds,
  Move,
  OddsTable,
  Pools,
  ShopFacts,
  WantedEquipment,
} from './types'

/** The most a request may ask for. The solvers' time and memory grow with both. */
export const SHOP_LIMITS = { badges: 500, copies: 4 }

// A range narrower than this is taken as one number.
const SETTLED = 1e-9

/** A chance is shown as a range when its floor and ceiling are at least this far apart. */
export const SHOWN_RANGE = 1e-3

export interface WantedHero {
  name: string
  copies: number
}

export interface ShopRequest {
  level: number
  /** Whether the shop level goes up next round. */
  rises: boolean
  shop: EnteredShop
  heroes: WantedHero[]
  equipment: WantedEquipment[]
  pools: Pools
  /** The move the comparison starts from, in place of a reroll with the locks as entered. */
  startFrom?: Move
}

export type AnswerGoal =
  { kind: 'hero' | 'equipment'; name: string } | { kind: 'any-hero' | 'any-equipment' | 'any' }

export interface ChanceAnswer extends ChanceAdvice {
  /** Buying only what is on show, when that shows another chance than the best move. */
  offers: Offers | null
}

export interface BadgeAnswer extends BadgeAdvice {
  /** Why the advice is to stop in place of the best move, or null. */
  stop: StopReason | null
}

export interface ShopAnswer {
  goal: AnswerGoal
  chance: ChanceAnswer
  badges: BadgeAnswer
  /** What to keep or buy before stopping, when either answer says to stop. */
  stopPlan: StopPlan | null
  /** Locks on other targets' cards whose sources never make anything this goal can use. */
  idleLocks: number[]
}

export type ShopResult =
  /** `settled`: whether these answers are the last for the request. */
  { answers: ShopAnswer[]; settled: boolean } | { error: 'impossible-shop' }

function checkRequest(request: ShopRequest): void {
  const { shop, heroes, equipment, startFrom } = request
  const whole = (value: number, least: number, most: number) =>
    Number.isInteger(value) && value >= least && value <= most
  if (!whole(shop.badges, 0, SHOP_LIMITS.badges)) throw new Error('shop: badges out of range')
  if (shop.cards.length !== SOURCES) throw new Error(`shop: a shop has ${SOURCES} cards`)
  if (shop.cards.some((card) => card.bought && (card.locked || !card.good))) {
    throw new Error('shop: a bought card is neither blank nor locked')
  }
  if (heroes.some((hero) => !whole(hero.copies, 1, SHOP_LIMITS.copies))) {
    throw new Error('shop: copies out of range')
  }
  if (!heroes.length && !equipment.length) throw new Error('shop: nothing is wanted')
  const names = [...heroes, ...equipment].map((item) => item.name)
  if (new Set(names).size !== names.length) throw new Error('shop: an item is wanted twice')
  if (startFrom?.kind === 'buy' && !shop.cards[startFrom.card]?.good) {
    throw new Error('shop: no card to start from')
  }
}

/**
 * One goal for each wanted item, then any wanted hero, any wanted piece and any
 * target at all. Copies of different heroes are never added together, so the
 * goals that span heroes are left out unless every hero needs one copy. A goal
 * with the same targets as an earlier one is left out.
 */
function goalsOf(request: ShopRequest): { name: AnswerGoal; goal: Goal }[] {
  const { heroes, equipment } = request
  const names = heroes.map((hero) => hero.name)
  const goals: { name: AnswerGoal; goal: Goal }[] = [
    ...heroes.map(({ name, copies }) => ({
      name: { kind: 'hero' as const, name },
      goal: { heroes: [name], equipment: [], copies },
    })),
    ...equipment.map((piece) => ({
      name: { kind: 'equipment' as const, name: piece.name },
      goal: { heroes: [], equipment: [piece], copies: 1 },
    })),
  ]
  const single = heroes.every((hero) => hero.copies === 1)
  if (single && heroes.length) {
    goals.push({ name: { kind: 'any-hero' }, goal: { heroes: names, equipment: [], copies: 1 } })
  }
  if (equipment.length) {
    goals.push({ name: { kind: 'any-equipment' }, goal: { heroes: [], equipment, copies: 1 } })
  }
  if (single) goals.push({ name: { kind: 'any' }, goal: { heroes: names, equipment, copies: 1 } })

  const seen = new Set<string>()
  return goals.filter(({ goal }) => {
    const targets = JSON.stringify([
      [...goal.heroes].sort(),
      goal.equipment.map((piece) => piece.name).sort(),
    ])
    if (seen.has(targets)) return false
    seen.add(targets)
    return true
  })
}

/** One goal's solvers, and the rows the search narrows. */
interface Work {
  name: AnswerGoal
  model: GoalModel
  max: MaxChance
  rows: ChanceRow[]
  current: ChanceRow | null
  kept: number[]
  order: number[]
  badges: BadgeAdvice
  /** The row of the cheapest move, when the badges allow the move. */
  cheapest: ChanceRow | null
  idleLocks: number[]
  /** The best way to stop, worked out when first asked for. */
  plan: () => StopPlan | null
  /** The ways to stop are costed at the next level, which the shop reaches next round. */
  rises: boolean
}

function prepare(
  request: ShopRequest,
  { name, goal }: { name: AnswerGoal; goal: Goal },
  reading: ShopReading,
  nextOdds: LevelOdds | null,
  facts: ShopFacts,
  cache: SolverCache,
): Work {
  const { shop, pools, startFrom } = request
  const { cards } = shop
  const model = goalModel(goal, reading.odds, pools, facts)
  const max = solveMaxChance(shop, goal, reading, pools, facts, cache)
  const min = solveMinBadges(shop, goal, reading, pools, facts, cache)

  const wanted = {
    heroes: new Set(request.heroes.map((hero) => hero.name)),
    equipment: new Set(request.equipment.map((piece) => piece.name)),
  }
  const pieces = new Set(goal.equipment.map((piece) => piece.name))
  const existing = cards.flatMap((card, i) => (card.locked && !card.bought ? [i] : []))
  const kept = existing.filter((i) => {
    const { hero, equipment } = cards[i]
    const target =
      (!!hero && wanted.heroes.has(hero)) || (!!equipment && wanted.equipment.has(equipment))
    const own = (!!hero && goal.heroes.includes(hero)) || (!!equipment && pieces.has(equipment))
    return target && !own
  })
  const idleLocks = kept.filter((card) => {
    const at = reading.cards.indexOf(card)
    return reading.worlds.every((world) => !model.sources[world.origins[at]].kinds.length)
  })

  const badges = adviseBadges(min, kept)
  const rerolls = (list: readonly Move[]) =>
    list.filter((move) => move.kind === 'reroll' && move.locks.length < cards.length)
  const moves = firstMoves(shop, wanted, facts)
  const can = shop.badges >= facts.reroll
  const basis: Move = startFrom ?? { kind: 'reroll', locks: existing }
  for (const move of rerolls([basis, ...(badges.best ? [badges.best.move] : [])])) {
    if (can && !moves.some((other) => sameMove(other, move))) moves.push(move)
  }
  const rows = moves.map((move) => ({ move, chance: max.range(move) }))
  const rowOf = (move: Move) => rows.find((row) => sameMove(row.move, move)) ?? null

  const cost = (card: number) =>
    model.kindOf(cards[card]) >= 0 ? min.cost({ kind: 'buy', card }).ceiling : Infinity
  const order = cards.map((_, i) => i).sort((a, b) => cost(a) - cost(b) || a - b)

  let plan: StopPlan | null | undefined
  return {
    name,
    model,
    max,
    rows,
    current: rowOf(basis),
    kept,
    order,
    badges,
    cheapest: badges.best && rowOf(badges.best.move),
    idleLocks,
    rises: nextOdds !== null,
    plan: () => {
      if (plan !== undefined) return plan
      const next = solveNextRound(shop, goal, reading, nextOdds, pools, facts, cache)
      const ways = [
        { kind: 'reroll', locks: existing } as Move,
        ...firstMoves({ ...shop, badges: Infinity }, wanted, facts),
        ...min.options.flat(),
      ]
      return (plan = next.best(ways))
    },
  }
}

const helps = (work: Work, shop: EnteredShop) => (move: Move) =>
  move.kind === 'reroll' || work.model.kindOf(shop.cards[move.card]) >= 0

// The search writes its answer into a row, and an answer already given keeps
// the figures it was given with.
const shown = (row: ChanceRow | null): ChanceRow | null => row && { ...row }

function answer(work: Work, shop: EnteredShop, facts: ShopFacts): ShopAnswer {
  const { model, badges } = work
  const advice = adviseChance({
    rows: work.rows,
    current: work.current,
    helps: helps(work, shop),
    own: (card) => {
      const kind = model.kindOf(shop.cards[card])
      return kind >= 0 && model.kinds[kind].certain
    },
    kept: work.kept,
    order: work.order,
  })
  let offers: Offers | null = null
  if (advice.best) {
    const only = solveOffers(shop, model, facts, work.order)
    if (Math.abs(only.chance - advice.best.chance.floor) >= SHOWS_AS_ZERO) offers = only
  }

  // A move the badges do not allow has no row, and no chance this round. A
  // range still open counts as a chance, so a move is only called impossible
  // once it is known to be.
  const chanceAfter = () => work.cheapest?.chance.ceiling ?? 0
  const wait = badges.best && work.rises ? work.plan() : null
  const stop = badges.best && stopReason(badges.best, shop, facts, chanceAfter, wait)

  return {
    goal: work.name,
    chance: {
      best: shown(advice.best),
      certain: advice.certain,
      keepLocks: shown(advice.keepLocks),
      current: shown(advice.current),
      offers,
    },
    badges: { ...badges, stop },
    stopPlan: !advice.best || stop ? work.plan() : null,
    idleLocks: work.idleLocks,
  }
}

/**
 * The row to search next, the one that reaches highest, or null when no range
 * left can change what the goal shows. A range matters when it reaches the best
 * chance, or the best among the rows that keep other targets' locks; when it is
 * the row the comparison starts from and wide enough to show as a range; or
 * when it leaves open whether the cheapest move can reach the goal at all.
 */
function unsettled(work: Work, shop: EnteredShop): ChanceRow | null {
  const open = work.rows.filter((row) => helps(work, shop)(row.move))
  const top = (list: readonly ChanceRow[]) => Math.max(0, ...list.map((row) => row.chance.floor))
  const best = top(open)
  const keeping = top(open.filter((row) => keepsLocks(row.move, work.kept)))
  let found: ChanceRow | null = null
  for (const row of work.rows) {
    const { floor, ceiling } = row.chance
    if (ceiling - floor <= SETTLED) continue
    const reaches =
      open.includes(row) &&
      (ceiling > best - SHOWS_AS_ZERO ||
        (work.kept.length > 0 &&
          keepsLocks(row.move, work.kept) &&
          ceiling > keeping - SHOWS_AS_ZERO))
    const shows = row === work.current && ceiling - floor >= SHOWN_RANGE
    const decides = row === work.cheapest && floor < SHOWS_AS_ZERO && ceiling >= SHOWS_AS_ZERO
    if (!reaches && !shows && !decides) continue
    if (!found || ceiling > found.chance.ceiling) found = row
  }
  return found
}

/**
 * The chance after a move, searched a slice at a time with a pause after each.
 * A slice that runs out of time starts again from the move, and finds every
 * shop it had finished already answered. Throws `OutOfTime` at the deadline.
 */
function* searchInSlices(
  max: MaxChance,
  move: Move,
  deadline: number,
  sliceMs: number,
): Generator<null, number> {
  for (;;) {
    try {
      return max.chance(move, Math.min(deadline, performance.now() + sliceMs))
    } catch (error) {
      if (!(error instanceof OutOfTime) || performance.now() >= deadline) throw error
      yield null
    }
  }
}

/**
 * Yields the answers as they stand: once with every row, then after each goal
 * the search has narrowed. The last result is marked settled. A null in between
 * is a pause, with nothing new to show. Throws for a request the form would not
 * send.
 */
export function* calculateShop(
  request: ShopRequest,
  table: OddsTable,
  facts: ShopFacts,
  cache: SolverCache,
  searchMs: number,
  sliceMs: number,
): Generator<ShopResult | null, void> {
  checkRequest(request)
  const { shop, level } = request
  if (!table.levels[level - 1]) throw new Error('shop: no such level')
  const rises = request.rises && level < table.levels.length
  const lower = table.levels.slice(0, level - 1).reverse()
  const reading = readShop(table.levels[level - 1], shop.cards, lower)
  if (!reading) {
    yield { error: 'impossible-shop' }
    return
  }

  const works: Work[] = []
  for (const goal of goalsOf(request)) {
    works.push(prepare(request, goal, reading, rises ? table.levels[level] : null, facts, cache))
    yield null
  }
  // A goal's way to stop into a higher level fills that level's cost tables,
  // the longest single piece of a request.
  const answers: ShopAnswer[] = []
  for (const work of works) {
    if (answers.length) yield null
    answers.push(answer(work, shop, facts))
  }
  const waiting = works.map((work) => unsettled(work, shop) !== null)
  if (!waiting.includes(true)) {
    yield { answers, settled: true }
    return
  }
  yield { answers: [...answers], settled: false }

  const deadline = performance.now() + searchMs
  try {
    for (const [index, work] of works.entries()) {
      if (!waiting[index]) continue
      for (let row = unsettled(work, shop); row; row = unsettled(work, shop)) {
        const chance = yield* searchInSlices(work.max, row.move, deadline, sliceMs)
        row.chance = { floor: chance, ceiling: chance }
      }
      answers[index] = answer(work, shop, facts)
      if (waiting.includes(true, index + 1)) yield { answers: [...answers], settled: false }
    }
  } catch (error) {
    if (!(error instanceof OutOfTime)) throw error
    works.forEach((work, index) => (answers[index] = answer(work, shop, facts)))
  }
  yield { answers, settled: true }
}
