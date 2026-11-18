/* What an Honor Duel board holds beyond a hero's place: each hero's tier,
 * equipment and off-field spot, and each side's artifact with its level. The
 * three hero values are attributes under ids of their own, apart from the
 * Arena's upgrade attributes, so a reader of either board's values finds none
 * of the other's. Their rules are in units.ts, since a unit's source sets its
 * tiers. */

import type { Team } from '@/lib/types/team'

export const DUEL_TIERS = ['epic', 'legendary', 'mythic', 'supreme'] as const

export type DuelTier = (typeof DUEL_TIERS)[number]

export const DUEL_ATTR_TIER = 101
export const DUEL_ATTR_EQUIPMENT = 102
export const DUEL_ATTR_SPOT = 103

// The widest id the board link's item fields hold. Whether an id names a piece
// or an artifact is the catalog's question: one that names none reads as none.
export const DUEL_ITEM_ID_MAX = 255

export const DUEL_SPOT_COUNT = 6

export const DUEL_ARTIFACT_LEVELS = 3

// A side's artifact with its level, 1 to DUEL_ARTIFACT_LEVELS.
export interface DuelArtifactSlot {
  id: number
  level: number
}

// The hero picking an off-field spot.
export interface DuelSpotPick {
  team: Team
  unitId: number
}
