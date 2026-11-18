/* What an Honor Duel board holds beyond a hero's place: each hero's tier and
 * equipment, and each side's artifact with its level. The two hero values are
 * attributes under ids of their own, apart from the Arena's upgrade
 * attributes, so a reader of either board's values finds none of the other's.
 * Their rules are in units.ts, since a unit's source sets its tiers. */

export const DUEL_TIERS = ['epic', 'legendary', 'mythic', 'supreme'] as const

export type DuelTier = (typeof DUEL_TIERS)[number]

export const DUEL_ATTR_TIER = 101
export const DUEL_ATTR_EQUIPMENT = 102

// The widest id the board link's item fields hold. Whether an id names a piece
// or an artifact is the catalog's question: one that names none reads as none.
export const DUEL_ITEM_ID_MAX = 255

export const DUEL_ARTIFACT_LEVELS = 3

// A side's artifact with its level, 1 to DUEL_ARTIFACT_LEVELS.
export interface DuelArtifactSlot {
  id: number
  level: number
}
