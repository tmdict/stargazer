// Phantimals share the grid's single unit slot with characters, tagged by an ID
// namespace. A tile whose characterId is
// in the phantimal band holds a phantimal, so occupancy, move, targeting
// and pathfinding treat it like any other unit for free. The differences are
// enforced elsewhere and are deliberately small: phantimals are exempt from the
// team-size limit (canPlaceCharacterOnTeam), capped at one per team by the
// character store's placement helpers, and swappable only within their own
// team (executeSwapCharacters).
// Keeping these as pure id-math (no Grid dependency) lets the serializer
// import them.
//
// Sits well above the companion band (N * COMPANION_ID_OFFSET + characterId) so a
// character with several companions never spills into the phantimal namespace.
//
// The band mirrors the base namespace like the synergy band: the phantimal at
// offset + L, companions its skill spawns at offset + N * 10000 + L, so the
// generic companion arithmetic (createCompanionSkill, getMainCharacterId)
// works unchanged inside it. The band's id math lives in this module (callers
// use the helpers below); without a phantimal companion skill registered, no
// id above the phantimals themselves is ever produced.
import { decomposeUnitId } from './synergy'
import { COMPANION_ID_OFFSET, PHANTIMAL_ID_OFFSET, SYNERGY_ID_OFFSET } from './unitIds'

// A phantimal or a companion it spawned. Bounded above: the
// synergy band starts at SYNERGY_ID_OFFSET and must not read as phantimals.
export function inPhantimalBand(id: number): boolean {
  return id >= PHANTIMAL_ID_OFFSET && id < SYNERGY_ID_OFFSET
}

// Band-local value, N * 10000 + L (N = 0 for the phantimal itself).
export function phantimalBandLocal(id: number): number {
  return id - PHANTIMAL_ID_OFFSET
}

// The phantimal itself, as opposed to a companion it spawned.
export function isPhantimalId(id: number): boolean {
  return inPhantimalBand(id) && phantimalBandLocal(id) < COMPANION_ID_OFFSET
}

// The phantimal a band unit belongs to (itself for a phantimal).
export function phantimalOwnerId(id: number): number {
  return PHANTIMAL_ID_OFFSET + (phantimalBandLocal(id) % COMPANION_ID_OFFSET)
}

export function toPhantimalId(localId: number): number {
  return PHANTIMAL_ID_OFFSET + localId
}

export function toLocalPhantimalId(id: number): number {
  return phantimalBandLocal(id) % COMPANION_ID_OFFSET
}

// A band-local value as the owning phantimal's local id plus the companion
// index N (0 for the phantimal itself), and back. The serialized forms (s rows,
// the binary companion section) are built from these.
export function splitPhantimalBandLocal(bandLocal: number): { ownerLocal: number; index: number } {
  return {
    ownerLocal: bandLocal % COMPANION_ID_OFFSET,
    index: Math.floor(bandLocal / COMPANION_ID_OFFSET),
  }
}

export function joinPhantimalBandLocal(ownerLocal: number, index: number): number {
  return index * COMPANION_ID_OFFSET + ownerLocal
}

// The id with its band offset stripped, so N * 10000 + base classifies the
// same way in the base, phantimal and synergy bands. Companion predicates
// read this; the skill registry must not (it keys phantimal skills by their
// namespaced id, and stripping would resolve phantimal 100005 to hero 5).
export function companionLocalId(id: number): number {
  return inPhantimalBand(id) ? phantimalBandLocal(id) : decomposeUnitId(id).localId
}
