import type { EquipmentTier } from '../../types/honorDuel'

// ---- Data ----

export type GoodKind = 'hero' | 'legendary' | 'pack' | 'equipment' | 'trial' | 'exp'

/** One product the shop sells. */
export interface Good {
  name: string
  price: number
  kind: GoodKind
  /** `hero` and `legendary`: copies of the one hero it gives. */
  copies?: number
  /** `pack`: heroes it picks. */
  draws?: number
  /** A faction pack's faction. */
  faction?: string
  tier?: EquipmentTier
}

/** One round of a run. */
export interface ShopRound {
  /** The badges the round brings; a round that can bring either of two amounts lists both. */
  badges: number[]
  /** The round's event, by the name its words are filed under. */
  event?: string
}

export interface ShopFacts {
  reroll: number
  startingBadges: number
  sell: number
  /** The first round of each shop level. */
  levelRounds: number[]
  /** The rounds from round 1 on; the last entry holds for every later round. */
  rounds: ShopRound[]
  goods: Good[]
  heroes: string[]
}

export interface SourceEntry {
  good: string
  percent: number
  low?: number
  high?: number
}

/** What each of a level's eight sources can make, in source-number order. */
export type LevelOdds = SourceEntry[][]

export interface OddsTable {
  /** Recorded rerolls behind each level. */
  rerolls?: number[]
  levels: LevelOdds[]
}

// ---- A request ----

export interface PoolHero {
  name: string
  faction: string
}

export interface Pools {
  /** The heroes a draw can pick. */
  heroes: PoolHero[]
  /** Heroes sold as soon as a pack gives them. */
  sell: ReadonlySet<string>
  /** How many pieces of each tier the shop sells. */
  equipment: Partial<Record<EquipmentTier, number>>
}

/** One of the eight cards on show. `good` is null for a card the player left blank. */
export interface ShopCard {
  good: string | null
  hero?: string
  equipment?: string
  locked: boolean
  /**
   * The shop level a locked card was locked at, when the player says it was a
   * lower one. A card bought while it names one keeps it.
   */
  lockedAt?: number
  bought: boolean
}

export interface EnteredShop {
  badges: number
  cards: ShopCard[]
}

export interface WantedEquipment {
  name: string
  tier: EquipmentTier
}

/**
 * What one answer is about. One hero may need several copies; with more than one
 * target, any single target finishes it and `copies` is 1.
 */
export interface Goal {
  heroes: string[]
  equipment: WantedEquipment[]
  copies: number
}

export type Move = { kind: 'buy'; card: number } | { kind: 'reroll'; locks: number[] }

export interface ChanceRange {
  floor: number
  ceiling: number
}

/** Badges spent on average: the true figure is no lower than `floor`, no higher than `ceiling`. */
export interface CostRange {
  floor: number
  ceiling: number
}
