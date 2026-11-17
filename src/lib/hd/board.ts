/* What an Honor Duel board holds beyond a hero's place: each hero's tier,
 * equipment and off-field spot, and each side's artifact with its level. The
 * three hero values are attributes under ids of their own, apart from the
 * Arena's upgrade attributes, so a reader of either board's values finds none
 * of the other's. */

import type { AttrRules } from '@/lib/characters/attributes'
import { isTrialHeroId } from '@/lib/characters/trial'

export const DUEL_TIERS = ['epic', 'legendary', 'mythic', 'supreme'] as const

export type DuelTier = (typeof DUEL_TIERS)[number]

export const DUEL_ATTR_TIER = 101
export const DUEL_ATTR_EQUIPMENT = 102
export const DUEL_ATTR_SPOT = 103

// Supreme is a Trial hero's alone.
export const duelTiersOf = (unitId: number): readonly DuelTier[] =>
  isTrialHeroId(unitId) ? DUEL_TIERS : DUEL_TIERS.slice(0, -1)

// The widest id the board link's item fields hold. Whether an id names a piece
// or an artifact is the catalog's question: one that names none reads as none.
export const DUEL_ITEM_ID_MAX = 255

export const DUEL_SPOT_COUNT = 6

export const DUEL_ARTIFACT_LEVELS = 3

const attrMax = (attrId: number, unitId: number): number | undefined => {
  if (attrId === DUEL_ATTR_TIER) return duelTiersOf(unitId).length - 1
  if (attrId === DUEL_ATTR_EQUIPMENT) return DUEL_ITEM_ID_MAX
  if (attrId === DUEL_ATTR_SPOT) return DUEL_SPOT_COUNT
  return undefined
}

export const DUEL_ATTR_RULES: AttrRules = {
  clamp: (attrId, value, unitId) => {
    const max = attrMax(attrId, unitId)
    if (max === undefined || !Number.isFinite(value)) return 0
    return Math.min(Math.max(Math.round(value), 0), max)
  },
  defaultOf: () => 0,
  // A side's spot holds one hero, and the other side's may be taken.
  sideBound: [DUEL_ATTR_SPOT],
}

// A side's artifact with its level, 1 to DUEL_ARTIFACT_LEVELS.
export interface DuelArtifactSlot {
  id: number
  level: number
}
