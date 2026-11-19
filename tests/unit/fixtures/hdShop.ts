/**
 * A made-up Honor Duel shop for the calculator's tests: 32 heroes, 8 in each
 * faction, 20 pieces of equipment of each rarity, and a frozen copy of the odds
 * table, so a new table on the site does not move the expected numbers.
 */

import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { solveMaxChance } from '@/lib/hd/shop/maxChance'
import { checkOdds } from '@/lib/hd/shop/odds'
import { createSolverCache } from '@/lib/hd/shop/solverCache'
import { readShop, type ShopReading } from '@/lib/hd/shop/sources'
import type {
  Goal,
  LevelOdds,
  Move,
  OddsTable,
  Pools,
  ShopCard,
  ShopFacts,
} from '@/lib/hd/shop/types'
import odds from './hdShopOdds.json'

const FACTIONS = ['lightbearer', 'mauler', 'wilder', 'graveborn']

/** `L1` to `L8` are Lightbearers, `M1` to `M8` Maulers, then `W` and `G`. */
export const HEROES = FACTIONS.flatMap((faction) =>
  Array.from({ length: 8 }, (_, i) => ({ name: `${faction[0]!.toUpperCase()}${i + 1}`, faction })),
)

export const FACTS: ShopFacts = { ...SHOP_FACTS, heroes: HEROES.map((hero) => hero.name) }

export const ODDS: OddsTable = checkOdds(odds as OddsTable, FACTS)

export const levelOdds = (level: number): LevelOdds => ODDS.levels[level - 1]!

export const pools = (sell: string[] = [], heroes = HEROES): Pools => ({
  heroes,
  sell: new Set(sell),
  equipment: { rare: 20, elite: 20, epic: 20 },
})

export const card = (good: string | null = null, more: Partial<ShopCard> = {}): ShopCard => ({
  good,
  locked: false,
  bought: false,
  ...more,
})

/** Eight cards: the ones given, then blanks. */
export const cards = (...shown: ShopCard[]): ShopCard[] => [
  ...shown,
  ...Array.from({ length: 8 - shown.length }, () => card()),
]

/** The cards as read at a level, for a shop the level can show. */
export function read(odds: LevelOdds, shown: readonly ShopCard[]): ShopReading {
  const reading = readShop(odds, shown)
  if (!reading) throw new Error('the shop cannot happen at this level')
  return reading
}

export const hero = (name: string, copies = 1): Goal => ({ heroes: [name], equipment: [], copies })

export const REROLL: Move = { kind: 'reroll', locks: [] }
export const buy = (at: number): Move => ({ kind: 'buy', card: at })
export const lock = (...locks: number[]): Move => ({ kind: 'reroll', locks })

/** Every hero but `L1`. */
export const others = HEROES.map((h) => h.name).filter((name) => name !== 'L1')

/** A level-1 shop with four packs on show. */
export const packShop = cards(
  card('random-pack'),
  card('lightbearer-pack'),
  card('wilder-pack'),
  card('rare-equipment'),
  card('artifact-exp'),
  card('artifact-exp'),
  card('random-pack'),
  card('rare-equipment'),
)

export interface Asked {
  level: number
  badges: number
  goal: Goal
  cards?: ShopCard[]
  sell?: string[]
}

/** The chance after `move`, searched to the end. */
export function chance(asked: Asked, move: Move = REROLL): number {
  const shop = { badges: asked.badges, cards: asked.cards ?? cards() }
  return solveMaxChance(
    shop,
    asked.goal,
    read(levelOdds(asked.level), shop.cards),
    pools(asked.sell),
    FACTS,
    createSolverCache(),
  ).chance(move)
}
