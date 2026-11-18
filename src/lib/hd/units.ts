/* Where a unit of an Honor Duel board comes from, the shop or a Trial Card
 * (src/data/hd/trial.json), and what that source lets it hold: its tiers, and
 * with them the rules for the values a unit carries. */

import trialList from '@/data/hd/trial.json'
import type { AttrRules } from '@/lib/characters/attributes'
import { isTrialHeroId } from '@/lib/characters/trial'
import { unitData } from '@/lib/characters/unitData'
import {
  DUEL_ATTR_EQUIPMENT,
  DUEL_ATTR_SPOT,
  DUEL_ATTR_TIER,
  DUEL_ITEM_ID_MAX,
  DUEL_SPOT_COUNT,
  DUEL_TIERS,
  type DuelTier,
} from './board'
import { SHOP_FACTS } from './shop/goods'

interface TrialCard {
  // The card's name in the shop's product list.
  card: string
  // The tier of a unit the card brings.
  tier: DuelTier
  // The heroes and creatures the card can show, by name.
  units?: readonly string[]
  // Whether the card can show any of the shop's heroes.
  shop?: boolean
}

// Returns the list unchanged, or throws. A tier outside the mode's list would
// read as a position before the first tier, and a pick at it as another unit's
// id.
function checkTrialCards(cards: readonly TrialCard[]): readonly TrialCard[] {
  for (const { card, tier } of cards) {
    if (!DUEL_TIERS.includes(tier)) throw new Error(`trial: ${card} has no tier "${tier}"`)
    if (!SHOP_FACTS.goods.some((good) => good.kind === 'trial' && good.name === card)) {
      throw new Error(`trial: the shop sells no Trial Card "${card}"`)
    }
  }
  return cards
}

// Cheapest first.
export const TRIAL_CARDS: readonly TrialCard[] = checkTrialCards(
  (trialList as { cards: TrialCard[] }).cards,
)

const SHOP_HEROES = new Set(SHOP_FACTS.heroes)

export const isShopHero = (name: string): boolean => SHOP_HEROES.has(name)

// A hero of the shop is bought at Epic and merges up to Mythic.
const SHOP_TIERS: readonly number[] = (['epic', 'legendary', 'mythic'] as const).map((tier) =>
  DUEL_TIERS.indexOf(tier),
)

export const trialCardBrings = (card: TrialCard, name: string): boolean =>
  (card.units?.includes(name) ?? false) || (card.shop === true && isShopHero(name))

/** The tiers a hero or creature may hold as a unit of the shop, or with
 * `trial` of the Trial Cards: positions in DUEL_TIERS, lowest first. Empty
 * when that source does not bring it. */
export function duelSourceTiers(name: string, trial: boolean): readonly number[] {
  if (!trial) return isShopHero(name) ? SHOP_TIERS : []
  const tiers = TRIAL_CARDS.filter((card) => trialCardBrings(card, name)).map((card) =>
    DUEL_TIERS.indexOf(card.tier),
  )
  return [...new Set(tiers)].sort((a, b) => a - b)
}

/** The tiers a unit on a board may hold, by its id. */
export function duelTiersOf(unitId: number): readonly number[] {
  const name = unitData(unitId)?.name
  return name === undefined ? [] : duelSourceTiers(name, isTrialHeroId(unitId))
}

const lowestTier = (unitId: number): number => duelTiersOf(unitId)[0] ?? 0

// The allowed tier closest to `tier`, the lower of two equally close.
const nearestTier = (unitId: number, tier: number): number =>
  duelTiersOf(unitId).reduce(
    (best, allowed) => (Math.abs(allowed - tier) < Math.abs(best - tier) ? allowed : best),
    lowestTier(unitId),
  )

const itemMax = (attrId: number): number | undefined => {
  if (attrId === DUEL_ATTR_EQUIPMENT) return DUEL_ITEM_ID_MAX
  if (attrId === DUEL_ATTR_SPOT) return DUEL_SPOT_COUNT
  return undefined
}

export const DUEL_ATTR_RULES: AttrRules = {
  clamp: (attrId, value, unitId) => {
    if (attrId === DUEL_ATTR_TIER) {
      return Number.isFinite(value) ? nearestTier(unitId, Math.round(value)) : lowestTier(unitId)
    }
    const max = itemMax(attrId)
    if (max === undefined || !Number.isFinite(value)) return 0
    return Math.min(Math.max(Math.round(value), 0), max)
  },
  // A unit starts at the lowest tier its source allows, so a unit with one
  // tier stores none.
  defaultOf: (attrId, unitId) => (attrId === DUEL_ATTR_TIER ? lowestTier(unitId) : 0),
  // A side's spot holds one hero, and the other side's may be taken. A piece
  // is its side's too: the other side's copies of the hero hold their own.
  sideBound: [DUEL_ATTR_SPOT, DUEL_ATTR_EQUIPMENT],
}
