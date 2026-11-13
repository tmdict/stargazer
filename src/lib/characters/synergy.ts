// A synergy hero is a friend-assist unit: one extra, duplicate-capable hero per
// team, tagged by an id namespace above the phantimal band. The band mirrors the
// base namespace shifted by the offset (the hero at offset + baseId, its
// skill-spawned companions at offset + N * 10000 + baseId), so companion
// arithmetic works unchanged inside it.
import { COMPANION_ID_OFFSET, SYNERGY_ID_OFFSET } from './unitIds'

const SYNERGY_BAND_END = 300000

export function inSynergyBand(id: number): boolean {
  return id >= SYNERGY_ID_OFFSET && id < SYNERGY_BAND_END
}

export function toSynergyId(baseId: number): number {
  return SYNERGY_ID_OFFSET + baseId
}

// The one place the mirror is decomposed. Subtraction on a bounded band, not
// modulo, so a future band above SYNERGY_BAND_END can never alias into the
// companion range.
export function decomposeUnitId(id: number): { synergy: boolean; localId: number } {
  return inSynergyBand(id)
    ? { synergy: true, localId: id - SYNERGY_ID_OFFSET }
    : { synergy: false, localId: id }
}

// The slot occupant itself, as opposed to a companion it spawned.
export function isSynergyHeroId(id: number): boolean {
  return inSynergyBand(id) && id - SYNERGY_ID_OFFSET < COMPANION_ID_OFFSET
}
