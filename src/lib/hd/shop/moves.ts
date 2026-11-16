// What a move leads to. For one goal, a card either cannot help or is one of a
// few useful kinds, each with the results a purchase can have; a reroll shows,
// from each free source, one of that source's useful kinds or nothing useful.

import { drawsHeroes } from './goods'
import { drawPool, equipmentShare, evenShare } from './pools'
import type { EnteredShop, Goal, Good, LevelOdds, Move, Pools, ShopCard, ShopFacts } from './types'

/** A gain that finishes a goal met by any one target. */
export const FINISHED = 99

/** One result of a purchase: targets gained, badges back from heroes sold, and its chance. */
export interface BuyOutcome {
  gain: number
  refund: number
  chance: number
}

/** A product that can help the goal. */
export interface UsefulKind {
  good: Good
  outcomes: BuyOutcome[]
  /** Whether a purchase always gives the same gain: a card of a wanted hero or piece. */
  certain: boolean
}

/** One source seen through the goal: the useful kinds it makes, by index into `GoalModel.kinds`. */
export interface GoalSource {
  kinds: number[]
  chances: number[]
  /** The chance it shows nothing useful. */
  none: number
}

export interface GoalModel {
  /** Targets still needed. */
  need: number
  reroll: number
  kinds: UsefulKind[]
  sources: GoalSource[]
  /** For each source, every source with the same odds for this goal, itself included. */
  twins: number[][]
  /** The useful kind of a card on show, or -1. */
  kindOf: (card: ShopCard) => number
  /** The results of buying a card that cannot help: only its refunds matter. */
  wasted: (card: ShopCard) => BuyOutcome[]
}

/** The results of buying a pack or the Random Legendary, one independent pick at a time. */
function drawOutcomes(good: Good, goal: Goal, pools: Pools, sell: number): BuyOutcome[] {
  const pool = drawPool(pools, good)
  const copies = good.copies ?? 1
  const wanted = new Set(goal.heroes)
  const sold = new Set(
    pool.filter((h) => !wanted.has(h.name) && pools.sell.has(h.name)).map((h) => h.name),
  )
  const hit = evenShare(pool, wanted)
  const sale = evenShare(pool, sold)
  const gain = goal.heroes.length === 1 ? copies : FINISHED

  let results = new Map<string, BuyOutcome>([['0|0', { gain: 0, refund: 0, chance: 1 }]])
  for (let pick = 0; pick < (good.draws ?? 1); pick++) {
    const next = new Map<string, BuyOutcome>()
    const add = (gained: number, refund: number, chance: number) => {
      if (chance <= 0) return
      const key = `${gained}|${refund}`
      const known = next.get(key)
      if (known) known.chance += chance
      else next.set(key, { gain: gained, refund, chance })
    }
    for (const result of results.values()) {
      add(result.gain + gain, result.refund, result.chance * hit)
      add(result.gain, result.refund + sell * copies, result.chance * sale)
      add(result.gain, result.refund, result.chance * (1 - hit - sale))
    }
    results = next
  }
  return [...results.values()]
}

/** The shop as one goal sees it: which products can help, and what each source makes of them. */
export function goalModel(
  goal: Goal,
  odds: LevelOdds,
  pools: Pools,
  facts: ShopFacts,
  cards: readonly ShopCard[] = [],
): GoalModel {
  const goods = new Map(facts.goods.map((good) => [good.name, good]))
  const heroes = new Set(goal.heroes.filter((name) => pools.heroes.some((h) => h.name === name)))
  const pieces = new Set(goal.equipment.map((piece) => piece.name))
  const single = goal.heroes.length === 1 && goal.equipment.length === 0

  // The chance a card of this product, fresh from a source, is a wanted one.
  const share = (good: Good): number => {
    if (good.kind === 'hero') return evenShare(pools.heroes, heroes)
    if (good.kind === 'equipment' && good.tier) {
      const wanted = goal.equipment.filter((piece) => piece.tier === good.tier).length
      return equipmentShare(pools, good.tier, wanted)
    }
    return 0
  }

  const kinds: UsefulKind[] = []
  const index = new Map<string, number>()
  const onShow = cards.flatMap((card) => (card.good ? [card.good] : []))
  const names = new Set([...odds.flat().map((entry) => entry.good), ...onShow])
  for (const name of [...names].sort()) {
    const good = goods.get(name)
    if (!good) continue
    if (drawsHeroes(good)) {
      const outcomes = drawOutcomes(good, { ...goal, heroes: [...heroes] }, pools, facts.sell)
      if (!outcomes.some((outcome) => outcome.gain > 0)) continue
      index.set(name, kinds.length)
      kinds.push({ good, outcomes, certain: false })
    } else if (share(good) > 0) {
      const gain = single ? (good.copies ?? 1) : FINISHED
      index.set(name, kinds.length)
      kinds.push({ good, outcomes: [{ gain, refund: 0, chance: 1 }], certain: true })
    }
  }

  const sources = odds.map((entries): GoalSource => {
    const chances = new Map<number, number>()
    for (const entry of entries) {
      const kind = index.get(entry.good)
      if (kind === undefined) continue
      const good = kinds[kind].good
      const chance = (entry.percent / 100) * (drawsHeroes(good) ? 1 : share(good))
      chances.set(kind, (chances.get(kind) ?? 0) + chance)
    }
    const list = [...chances].sort((a, b) => a[0] - b[0])
    return {
      kinds: list.map(([kind]) => kind),
      chances: list.map(([, chance]) => chance),
      none: 1 - list.reduce((sum, [, chance]) => sum + chance, 0),
    }
  })

  const alike = new Map<string, number[]>()
  const signature = sources.map((source) => JSON.stringify([source.kinds, source.chances]))
  signature.forEach((key, source) => alike.set(key, [...(alike.get(key) ?? []), source]))

  const kindOf = (card: ShopCard): number => {
    const good = card.good && !card.bought ? goods.get(card.good) : undefined
    if (!good) return -1
    const kind = index.get(good.name) ?? -1
    if (drawsHeroes(good)) return kind
    if (good.kind === 'hero') return card.hero && heroes.has(card.hero) ? kind : -1
    if (good.kind === 'equipment') return card.equipment && pieces.has(card.equipment) ? kind : -1
    return -1
  }

  const wasted = (card: ShopCard): BuyOutcome[] => {
    const good = card.good ? goods.get(card.good) : undefined
    if (!good || !drawsHeroes(good)) return [{ gain: 0, refund: 0, chance: 1 }]
    return drawOutcomes(good, { ...goal, heroes: [...heroes] }, pools, facts.sell)
  }

  return {
    need: single ? goal.copies : 1,
    reroll: facts.reroll,
    kinds,
    sources,
    twins: signature.map((key) => alike.get(key)!),
    kindOf,
    wasted,
  }
}

export interface Wanted {
  heroes: ReadonlySet<string>
  equipment: ReadonlySet<string>
}

function subsets(list: readonly number[]): number[][] {
  return Array.from({ length: 1 << list.length }, (_, mask) =>
    list.filter((_, bit) => (mask >> bit) & 1),
  )
}

/**
 * The first moves compared for the shop as entered: every useful purchase the
 * badges allow, and a reroll with each lock set worth telling apart. With eight
 * cards there are 256 lock sets, most of them the same move in all but name, so
 * the rerolls listed are the current locks, the current locks with one card
 * fewer or one more, none, and every set of packs and wanted cards.
 */
export function firstMoves(shop: EnteredShop, wanted: Wanted, facts: ShopFacts): Move[] {
  const goods = new Map(facts.goods.map((good) => [good.name, good]))
  const good = (card: ShopCard) => (card.good ? goods.get(card.good) : undefined)
  const isPack = (card: ShopCard) => {
    const product = good(card)
    return !!product && drawsHeroes(product)
  }
  const isWanted = (card: ShopCard) =>
    (!!card.hero && wanted.heroes.has(card.hero)) ||
    (!!card.equipment && wanted.equipment.has(card.equipment))
  const { cards } = shop
  const all = cards.map((_, index) => index)
  const locked = all.filter((i) => cards[i].locked && !cards[i].bought)
  const open = all.filter((i) => !cards[i].locked && !cards[i].bought)

  const moves: Move[] = []
  if (shop.badges >= facts.reroll) {
    const rerolls = new Map<string, number[]>()
    const add = (locks: number[]) => {
      // A shop with every card locked has nothing to reroll.
      if (locks.length >= cards.length) return
      const sorted = [...locks].sort((a, b) => a - b)
      rerolls.set(sorted.join(','), sorted)
    }
    add(locked)
    for (const card of locked) add(locked.filter((other) => other !== card))
    add([])
    for (const card of open) if (cards[card].good) add([...locked, card])
    for (const extra of subsets(open.filter((i) => isPack(cards[i])))) add([...locked, ...extra])
    const useful = all.filter((i) => !cards[i].bought && (isPack(cards[i]) || isWanted(cards[i])))
    for (const chosen of subsets(useful)) add(chosen)
    for (const locks of rerolls.values()) moves.push({ kind: 'reroll', locks })
  }
  cards.forEach((card, index) => {
    const product = good(card)
    if (card.bought || !product || product.price > shop.badges) return
    if (isPack(card) || isWanted(card)) moves.push({ kind: 'buy', card: index })
  })
  return moves
}
