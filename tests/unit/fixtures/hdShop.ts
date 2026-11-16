/**
 * A made-up Honor Duel shop for the calculator's tests: 32 heroes, 8 in each
 * faction, 20 pieces of equipment of each rarity, and a frozen copy of the odds
 * table, so a new table on the site does not move the expected numbers.
 */

import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { solveMaxChance } from '@/lib/hd/shop/maxChance'
import { checkOdds } from '@/lib/hd/shop/odds'
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

export const hero = (name: string, copies = 1): Goal => ({ heroes: [name], equipment: [], copies })

export const REROLL: Move = { kind: 'reroll', locks: [] }

export interface Asked {
  level: number
  badges: number
  goal: Goal
  cards?: ShopCard[]
  sell?: string[]
}

/** The chance after `move`, searched to the end. */
export function chance(asked: Asked, move: Move = REROLL): number {
  const solved = solveMaxChance(
    { badges: asked.badges, cards: asked.cards ?? cards() },
    asked.goal,
    levelOdds(asked.level),
    pools(asked.sell),
    FACTS,
  )
  if (!solved) throw new Error('the shop cannot happen at this level')
  return solved.chance(move)
}
