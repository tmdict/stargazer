/* The Honor Duel board as text: what a `?hd=` link carries and what the board
 * is stored as. Bit-sequential and LSB-first in the Arena link's URL-safe
 * alphabet, with a layout of its own:
 *
 *   header      view switches 8 (bits 5-7 spare) · map 6 · parts 8 (bit 0
 *               units, bit 1 artifacts, bits 2-7 spare)
 *   units       count 4, then for each unit in tile order: tile 6 · team 1 ·
 *               hero 14 · Trial 1 · tier 2 · equipment 8
 *   artifacts   for the ally side, then the enemy side: artifact 8 · level 2
 *
 * A board has exactly one text. Decoding is all or nothing: a spare bit set, a
 * value outside its range, units out of tile order or a part marked present
 * but empty refuses the whole text. Whether an id still names a hero, a piece
 * of equipment or an artifact is the reader's question, not the layout's.
 */

import { BitReader, BitWriter, bytesToUrlSafe, inRange, urlSafeToBytes } from '@/lib/teams/bitCodec'
import { mapKeyByWireId, mapWireIdByKey } from '@/lib/teams/wire'
import { Team } from '@/lib/types/team'
import { DUEL_ARTIFACT_LEVELS, DUEL_ITEM_ID_MAX, DUEL_TIERS, type DuelArtifactSlot } from './board'
import { isDuelMap } from './maps'

export interface DuelUnitState {
  hexId: number
  team: Team
  heroId: number
  trial: boolean
  // Position in DUEL_TIERS.
  tier: number
  // 0 for none.
  equipment: number
}

export interface DuelBoardState {
  // The view switches, packed as the Arena link packs them.
  d: number
  map: string
  // In tile order.
  units: DuelUnitState[]
  artifacts: { ally: DuelArtifactSlot | null; enemy: DuelArtifactSlot | null }
}

const VIEW_SWITCH_BITS = 5
const MAX_TILE = 45
const MAX_HERO_ID = 8999
const MAX_UNITS = 15
const SUPREME = DUEL_TIERS.indexOf('supreme')

const PART_UNITS = 1 << 0
const PART_ARTIFACTS = 1 << 1
const KNOWN_PARTS = PART_UNITS | PART_ARTIFACTS

const validUnit = (unit: DuelUnitState): boolean =>
  inRange(unit.hexId, 1, MAX_TILE) &&
  (unit.team === Team.ALLY || unit.team === Team.ENEMY) &&
  inRange(unit.heroId, 1, MAX_HERO_ID) &&
  inRange(unit.tier, 0, unit.trial ? SUPREME : SUPREME - 1) &&
  inRange(unit.equipment, 0, DUEL_ITEM_ID_MAX)

const validArtifact = (slot: DuelArtifactSlot | null): boolean =>
  slot === null ||
  (inRange(slot.id, 1, DUEL_ITEM_ID_MAX) && inRange(slot.level, 1, DUEL_ARTIFACT_LEVELS))

const inTileOrder = (units: readonly DuelUnitState[]): boolean =>
  units.every((unit, i) => i === 0 || units[i - 1]!.hexId < unit.hexId)

// Throws on a board the layout cannot hold, which only a bug produces: the
// board's own rules keep every value inside its field.
export function encodeDuelBoard(state: DuelBoardState): string {
  const mapId = isDuelMap(state.map) ? mapWireIdByKey(state.map) : undefined
  const { ally, enemy } = state.artifacts
  if (
    mapId === undefined ||
    !inRange(state.d, 0, (1 << VIEW_SWITCH_BITS) - 1) ||
    state.units.length > MAX_UNITS ||
    !state.units.every(validUnit) ||
    !inTileOrder(state.units) ||
    !validArtifact(ally) ||
    !validArtifact(enemy)
  ) {
    throw new Error('Honor Duel board does not fit its link layout')
  }

  const hasUnits = state.units.length > 0
  const hasArtifacts = ally !== null || enemy !== null
  const writer = new BitWriter()
  writer.writeBits(state.d, 8)
  writer.writeBits(mapId, 6)
  writer.writeBits((hasUnits ? PART_UNITS : 0) | (hasArtifacts ? PART_ARTIFACTS : 0), 8)
  if (hasUnits) {
    writer.writeBits(state.units.length, 4)
    for (const unit of state.units) {
      writer.writeBits(unit.hexId, 6)
      writer.writeBits(unit.team === Team.ENEMY ? 1 : 0, 1)
      writer.writeBits(unit.heroId, 14)
      writer.writeBits(unit.trial ? 1 : 0, 1)
      writer.writeBits(unit.tier, 2)
      writer.writeBits(unit.equipment, 8)
    }
  }
  if (hasArtifacts) {
    for (const slot of [ally, enemy]) {
      writer.writeBits(slot?.id ?? 0, 8)
      writer.writeBits(slot?.level ?? 0, 2)
    }
  }
  return bytesToUrlSafe(writer.getBytes())
}

// Undefined for an artifact and a level that do not fit each other.
const readArtifact = (reader: BitReader): DuelArtifactSlot | null | undefined => {
  const id = reader.readBits(8)
  const level = reader.readBits(2)
  if (id === 0) return level === 0 ? null : undefined
  return level === 0 ? undefined : { id, level }
}

// Null for any text that is not exactly one board's.
export function decodeDuelBoard(text: string): DuelBoardState | null {
  const bytes = urlSafeToBytes(text)
  if (!bytes || bytes.length === 0) return null
  try {
    const reader = new BitReader(bytes)
    const d = reader.readBits(8)
    if (d >> VIEW_SWITCH_BITS !== 0) return null
    const map = mapKeyByWireId(reader.readBits(6))
    if (map === undefined || !isDuelMap(map)) return null
    const parts = reader.readBits(8)
    if ((parts & ~KNOWN_PARTS) !== 0) return null

    const units: DuelUnitState[] = []
    if (parts & PART_UNITS) {
      const count = reader.readBits(4)
      if (count === 0) return null
      for (let i = 0; i < count; i++) {
        units.push({
          hexId: reader.readBits(6),
          team: reader.readBits(1) === 1 ? Team.ENEMY : Team.ALLY,
          heroId: reader.readBits(14),
          trial: reader.readBits(1) === 1,
          tier: reader.readBits(2),
          equipment: reader.readBits(8),
        })
      }
      if (!units.every(validUnit) || !inTileOrder(units)) return null
    }

    const artifacts: DuelBoardState['artifacts'] = { ally: null, enemy: null }
    if (parts & PART_ARTIFACTS) {
      const ally = readArtifact(reader)
      const enemy = readArtifact(reader)
      if (ally === undefined || enemy === undefined || (ally === null && enemy === null)) {
        return null
      }
      artifacts.ally = ally
      artifacts.enemy = enemy
    }

    // Trailing bits and the last character's spare bits are judged in one
    // step: only the text the encoder writes for this board is taken.
    const state = { d, map, units, artifacts }
    return encodeDuelBoard(state) === text ? state : null
  } catch {
    return null
  }
}
