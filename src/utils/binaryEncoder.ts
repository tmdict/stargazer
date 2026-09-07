import { attrDefault, clampAttr, isKnownAttrId } from '@/lib/characters/attributes'
import { mapKeyByWireId, mapWireIdByKey, wireModeById, wireModeByKey } from '@/lib/teams/wire'
import {
  packDisplayFlags,
  unpackDisplayFlags,
  type BoardState,
  type GridState,
} from './gridStateSerializer'

/**
 * Binary link codec: one compact format for every share link — the Arena is
 * simply wire mode 0 with one board. Storage and export files use the JSON
 * encoding instead (urlStateManager); the only binary value at rest is the
 * arena autosave, by owner decision.
 *
 * Format (bit-sequential, LSB-first per BitWriter):
 *
 * Envelope (14 bits):
 * - Mode id (3 bits): wire registry (lib/teams/wire.ts); board count derives
 *   from the mode, so no count field exists.
 * - Active board (3 bits): 0-based.
 * - Display flags (8 bits): the packDisplayFlags byte (wrap, skills,
 *   perspective, inverted, teamView; 3 spare). Always present — an absent `d`
 *   is encoded as the unpack defaults so pre-flags states keep today's
 *   skills/perspective-on behavior.
 *
 * Each board (14-bit header, then its sections):
 * - Map id (6 bits): wire registry; 0 = none (arena boards, whose serialized
 *   tiles are authoritative).
 * - Section bitmap (8 bits): bit 0 tiles · 1 characters · 2 artifacts ·
 *   3 phantimals · 4 synergy · 5 upgrades; bits 6-7 spare for future
 *   sections. Sections are written in bit order.
 *
 * Sections:
 * - tiles:      count (6) + 9 bits/entry  — hexId 6 · state 3
 * - characters: count (6) + 23 bits/entry — hexId 6 · characterId 16 · team 1
 * - artifacts:  12 bits, no count         — ally 6 · enemy 6 (0 = none)
 * - phantimals: count (4) + 11 bits/entry — hexId 6 · local id 4 · team 1
 * - synergy:    count (4) + 23 bits/entry — hexId 6 · local id 16 · team 1
 * - upgrades:   count (6) + 27 bits/entry — team 1 · characterId 16 (0 =
 *   team-scope sentinel) · attrId 6 · value 4
 *
 * The 16-bit character field also carries companion ids (N * 10000 + base,
 * see grid.ts), which caps companion index N at 6 for base ids below 5536.
 *
 * Decoding is STRICT: unknown mode, map, or section-bitmap bits reject, and
 * the entire input must be consumed with only zero padding bits remaining.
 * That is what makes another format's bytes practically impossible to
 * misread as a valid link, which the shim's probe order relies on. No version
 * field, deliberately: the app and its links deploy together, links are
 * expendable, and only the arena autosave outlives a deploy (converted by a
 * temporary shim per format change).
 */

const MODE_BITS = 3
const ACTIVE_BITS = 3
const DISPLAY_FLAGS_BITS = 8
const MAP_ID_BITS = 6
const SECTION_BITMAP_BITS = 8

const HEX_ID_BITS = 6 // Supports hex IDs 0-63
const TILE_STATE_BITS = 3 // Supports states 0-7
const TEAM_BITS = 1 // Supports 2 teams
const CHARACTER_ID_BITS = 16 // Supports IDs 0-65535 (covers companion IDs, see format note)
const MAX_CHARACTER_ID = (1 << CHARACTER_ID_BITS) - 1 // 65535
const ARTIFACT_BITS = 6 // Supports artifact IDs 0-63 (0 = null)
const MAX_ARTIFACT_ID = (1 << ARTIFACT_BITS) - 1 // 63
const PHANTIMAL_ID_BITS = 4 // Supports local phantimal IDs 1-15
const MAX_PHANTIMAL_ID = (1 << PHANTIMAL_ID_BITS) - 1 // 15
const TILE_COUNT_BITS = 6 // A 45-hex board keeps every count under 63
const MAX_TILE_COUNT = (1 << TILE_COUNT_BITS) - 1 // 63
const CHARACTER_COUNT_BITS = 6
const MAX_CHARACTER_COUNT = (1 << CHARACTER_COUNT_BITS) - 1 // 63
const PHANTIMAL_COUNT_BITS = 4
const MAX_PHANTIMAL_COUNT = (1 << PHANTIMAL_COUNT_BITS) - 1 // 15
const SYNERGY_COUNT_BITS = 4
const MAX_SYNERGY_COUNT = (1 << SYNERGY_COUNT_BITS) - 1 // 15
const UPGRADE_COUNT_BITS = 6
const MAX_UPGRADE_COUNT = (1 << UPGRADE_COUNT_BITS) - 1 // 63
const ATTR_ID_BITS = 6 // Supports attrIds 1-63
const ATTR_VALUE_BITS = 4 // Supports values 0-15; registry maxes must fit

const SECTION_TILES = 0x01
const SECTION_CHARACTERS = 0x02
const SECTION_ARTIFACTS = 0x04
const SECTION_PHANTIMALS = 0x08
const SECTION_SYNERGY = 0x10
const SECTION_UPGRADES = 0x20
const KNOWN_SECTIONS =
  SECTION_TILES |
  SECTION_CHARACTERS |
  SECTION_ARTIFACTS |
  SECTION_PHANTIMALS |
  SECTION_SYNERGY |
  SECTION_UPGRADES

/* A decoded (or encodable) link: the envelope plus one content board per the
 * mode's board count. `mode` is the wire registry key — 'arena' or a team
 * mode key; boards carry no `d` (the envelope owns the display flags). */
export interface BinaryLinkState {
  mode: string
  active: number
  d: number
  boards: BoardState[]
}

export interface BinaryLinkInput {
  mode: string
  active?: number
  d?: number
  boards: BoardState[]
}

/**
 * Validates and filters grid state to ensure all values are within valid ranges.
 * This prevents encoding errors and ensures encoder/decoder stay in sync.
 */
export function validateGridState(state: GridState): GridState {
  // Handle null, undefined, or non-object inputs
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return {}
  }

  const validated: GridState = {}

  // Validate tile entries: hexId must be 1-63, state must be 0-7
  // We filter out invalid entries to ensure the count matches actual data written
  if (state.t && Array.isArray(state.t)) {
    let validTiles = state.t.filter((entry) => {
      const [hexId, tileState] = entry
      const isValid =
        hexId != null &&
        hexId > 0 &&
        hexId <= 63 &&
        tileState != null &&
        tileState >= 0 &&
        tileState <= 7
      if (!isValid && (hexId == null || hexId <= 0 || hexId > 63)) {
        console.warn(`Invalid tile entry: hexId ${hexId} out of range (1-63)`, entry)
      }
      return isValid
    })
    // Cap at the count field's maximum so the encoded count can't wrap.
    if (validTiles.length > MAX_TILE_COUNT) {
      console.warn(`Too many tile entries (${validTiles.length}), keeping first ${MAX_TILE_COUNT}`)
      validTiles = validTiles.slice(0, MAX_TILE_COUNT)
    }
    if (validTiles.length > 0) {
      validated.t = validTiles
    }
  }

  // Validate character entries: hexId 1-63, charId 1-65535, team 1-2
  // This ensures character IDs fit in 16 bits and teams in 1 bit
  if (state.c && Array.isArray(state.c)) {
    let validChars = state.c.filter((entry) => {
      const [hexId, charId, team] = entry
      const isValid =
        hexId != null &&
        hexId > 0 &&
        hexId <= 63 &&
        charId != null &&
        charId > 0 &&
        charId <= MAX_CHARACTER_ID &&
        (team === 1 || team === 2)
      if (!isValid) {
        console.warn('Invalid character entry:', {
          hexId: hexId ?? 'undefined',
          charId: charId ?? 'undefined',
          team: team ?? 'undefined',
          limits: { maxHexId: 63, maxCharId: MAX_CHARACTER_ID, validTeams: [1, 2] },
        })
      }
      return isValid
    })
    if (validChars.length > MAX_CHARACTER_COUNT) {
      console.warn(
        `Too many character entries (${validChars.length}), keeping first ${MAX_CHARACTER_COUNT}`,
      )
      validChars = validChars.slice(0, MAX_CHARACTER_COUNT)
    }
    if (validChars.length > 0) {
      validated.c = validChars
    }
  }

  // Artifacts: must be array with exactly 2 elements; each element null or an ID
  // within the 6-bit field (1-63). Out-of-range IDs become null; writeBits would
  // otherwise silently truncate them to a different artifact's ID.
  if (state.a && Array.isArray(state.a) && state.a.length === 2) {
    validated.a = state.a.map((id) => {
      if (id == null) return null
      if (Number.isInteger(id) && id > 0 && id <= MAX_ARTIFACT_ID) return id
      console.warn(`Invalid artifact ID ${id} (valid: 1-${MAX_ARTIFACT_ID}), dropping`)
      return null
    })
  }

  // Validate phantimal entries: hexId 1-63, local id 1-15, team 1-2
  if (state.s && Array.isArray(state.s)) {
    let validPhantimals = state.s.filter((entry) => {
      const [hexId, localId, team] = entry
      const isValid =
        hexId != null &&
        hexId > 0 &&
        hexId <= 63 &&
        localId != null &&
        localId > 0 &&
        localId <= MAX_PHANTIMAL_ID &&
        (team === 1 || team === 2)
      if (!isValid) {
        console.warn('Invalid phantimal entry:', entry)
      }
      return isValid
    })
    if (validPhantimals.length > MAX_PHANTIMAL_COUNT) {
      console.warn(
        `Too many phantimal entries (${validPhantimals.length}), keeping first ${MAX_PHANTIMAL_COUNT}`,
      )
      validPhantimals = validPhantimals.slice(0, MAX_PHANTIMAL_COUNT)
    }
    if (validPhantimals.length > 0) {
      validated.s = validPhantimals
    }
  }

  // Validate synergy entries: hexId 1-63, local id 1-65535, team 1-2
  if (state.y && Array.isArray(state.y)) {
    let validSynergy = state.y.filter((entry) => {
      const [hexId, localId, team] = entry
      const isValid =
        hexId != null &&
        hexId > 0 &&
        hexId <= 63 &&
        localId != null &&
        localId > 0 &&
        localId <= MAX_CHARACTER_ID &&
        (team === 1 || team === 2)
      if (!isValid) {
        console.warn('Invalid synergy entry:', entry)
      }
      return isValid
    })
    if (validSynergy.length > MAX_SYNERGY_COUNT) {
      console.warn(
        `Too many synergy entries (${validSynergy.length}), keeping first ${MAX_SYNERGY_COUNT}`,
      )
      validSynergy = validSynergy.slice(0, MAX_SYNERGY_COUNT)
    }
    if (validSynergy.length > 0) {
      validated.y = validSynergy
    }
  }

  // Validate upgrade rows: team 1-2, charId 0-65535 (0 = team-scope sentinel),
  // known attrId; values clamp to the registry range rather than dropping.
  // Deduped last-wins with defaults dropped — mirrors canonicalAttrRows, so a
  // crafted link carrying duplicate or zero rows can't burn the 63-row cap or
  // persist junk through the arena autosave's decode/re-encode.
  if (state.u && Array.isArray(state.u)) {
    const byKey = new Map<string, [number, number, number, number]>()
    for (const entry of state.u) {
      const [team, charId, attrId] = entry
      if (
        (team !== 1 && team !== 2) ||
        charId == null ||
        charId < 0 ||
        charId > MAX_CHARACTER_ID ||
        attrId == null ||
        !isKnownAttrId(attrId)
      ) {
        console.warn('Invalid upgrade entry:', entry)
        continue
      }
      const value = clampAttr(attrId, entry[3] ?? 0)
      const key = `${team}:${charId}:${attrId}`
      if (value !== attrDefault(attrId)) byKey.set(key, [team, charId, attrId, value])
      else byKey.delete(key)
    }
    let validUpgrades = [...byKey.values()]
    if (validUpgrades.length > MAX_UPGRADE_COUNT) {
      console.warn(
        `Too many upgrade entries (${validUpgrades.length}), keeping first ${MAX_UPGRADE_COUNT}`,
      )
      validUpgrades = validUpgrades.slice(0, MAX_UPGRADE_COUNT)
    }
    if (validUpgrades.length > 0) {
      validated.u = validUpgrades
    }
  }

  // Display flags: passed through for callers; the link envelope owns them
  // during encoding (boards never carry a flags byte).
  if (state.d !== undefined) {
    validated.d = state.d
  }

  return validated
}

class BitWriter {
  private buffer: number[] = []
  private currentByte = 0
  private bitPosition = 0

  writeBits(value: number, bitCount: number): void {
    for (let i = 0; i < bitCount; i++) {
      const bit = (value >> i) & 1
      this.currentByte |= bit << this.bitPosition
      this.bitPosition++

      if (this.bitPosition === 8) {
        this.buffer.push(this.currentByte)
        this.currentByte = 0
        this.bitPosition = 0
      }
    }
  }

  getBytes(): Uint8Array {
    // Push any remaining bits
    if (this.bitPosition > 0) {
      this.buffer.push(this.currentByte)
    }
    return new Uint8Array(this.buffer)
  }
}

class BitReader {
  private position = 0

  constructor(private bytes: Uint8Array) {}

  readBits(bitCount: number): number {
    let value = 0
    for (let i = 0; i < bitCount; i++) {
      const byteIndex = Math.floor((this.position + i) / 8)
      const bitIndex = (this.position + i) % 8

      if (byteIndex >= this.bytes.length) {
        throw new Error('Unexpected end of data')
      }

      const byte = this.bytes[byteIndex]
      if (byte === undefined) {
        throw new Error('Unexpected end of data')
      }
      const bit = (byte >> bitIndex) & 1
      value |= bit << i
    }
    this.position += bitCount
    return value
  }

  // True only when every remaining bit is final-byte zero padding: the strict
  // full-consumption rule that keeps another format's bytes from misreading
  // as a valid link.
  atCleanEnd(): boolean {
    const remaining = this.bytes.length * 8 - this.position
    if (remaining < 0 || remaining >= 8) return false
    return remaining === 0 || this.readBits(remaining) === 0
  }
}

// The envelope's flags byte is mandatory, so an absent `d` encodes as the
// unpack defaults — a pre-flags state must not flip skills/perspective off.
const flagsByte = (d: number | undefined): number =>
  (d ?? packDisplayFlags(unpackDisplayFlags(undefined))) & 0xff

function encodeBoard(writer: BitWriter, board: BoardState): void {
  const state = validateGridState(board)

  let mapId = 0
  if (board.m !== undefined) {
    const wireId = mapWireIdByKey(board.m)
    if (wireId === undefined) {
      // The board still restores via its serialized tiles; only the Maps-tab
      // highlight goes stale for the recipient.
      console.warn(`Map key "${board.m}" has no wire id, encoding as none`)
    }
    mapId = wireId ?? 0
  }
  writer.writeBits(mapId, MAP_ID_BITS)

  let bitmap = 0
  if (state.t) bitmap |= SECTION_TILES
  if (state.c) bitmap |= SECTION_CHARACTERS
  if (state.a) bitmap |= SECTION_ARTIFACTS
  if (state.s) bitmap |= SECTION_PHANTIMALS
  if (state.y) bitmap |= SECTION_SYNERGY
  if (state.u) bitmap |= SECTION_UPGRADES
  writer.writeBits(bitmap, SECTION_BITMAP_BITS)

  if (state.t) {
    writer.writeBits(state.t.length, TILE_COUNT_BITS)
    for (const entry of state.t) {
      writer.writeBits(entry[0]!, HEX_ID_BITS)
      writer.writeBits(entry[1]!, TILE_STATE_BITS)
    }
  }

  if (state.c) {
    writer.writeBits(state.c.length, CHARACTER_COUNT_BITS)
    for (const entry of state.c) {
      writer.writeBits(entry[0]!, HEX_ID_BITS)
      writer.writeBits(entry[1]!, CHARACTER_ID_BITS)
      writer.writeBits(entry[2]! - 1, TEAM_BITS)
    }
  }

  if (state.a) {
    writer.writeBits(state.a[0] ?? 0, ARTIFACT_BITS)
    writer.writeBits(state.a[1] ?? 0, ARTIFACT_BITS)
  }

  if (state.s) {
    writer.writeBits(state.s.length, PHANTIMAL_COUNT_BITS)
    for (const entry of state.s) {
      writer.writeBits(entry[0]!, HEX_ID_BITS)
      writer.writeBits(entry[1]!, PHANTIMAL_ID_BITS)
      writer.writeBits(entry[2]! - 1, TEAM_BITS)
    }
  }

  if (state.y) {
    writer.writeBits(state.y.length, SYNERGY_COUNT_BITS)
    for (const entry of state.y) {
      writer.writeBits(entry[0]!, HEX_ID_BITS)
      writer.writeBits(entry[1]!, CHARACTER_ID_BITS)
      writer.writeBits(entry[2]! - 1, TEAM_BITS)
    }
  }

  if (state.u) {
    writer.writeBits(state.u.length, UPGRADE_COUNT_BITS)
    for (const entry of state.u) {
      writer.writeBits(entry[0]! - 1, TEAM_BITS)
      writer.writeBits(entry[1]!, CHARACTER_ID_BITS)
      writer.writeBits(entry[2]!, ATTR_ID_BITS)
      writer.writeBits(entry[3]!, ATTR_VALUE_BITS)
    }
  }
}

export function encodeLink(link: BinaryLinkInput): Uint8Array {
  const mode = wireModeByKey(link.mode)
  if (!mode) {
    throw new Error(`Unknown wire mode: ${link.mode}`)
  }

  // The decoder derives board count from the mode, so the encoded list must
  // match it exactly; our own callers always agree, so a mismatch is crafted
  // input and gets the filter-and-warn treatment.
  let boards = link.boards
  if (boards.length !== mode.boardCount) {
    console.warn(`Mode ${mode.key} expects ${mode.boardCount} boards, got ${boards.length}`)
    boards = boards.slice(0, mode.boardCount)
    while (boards.length < mode.boardCount) boards = [...boards, {}]
  }

  const writer = new BitWriter()
  writer.writeBits(mode.wireId, MODE_BITS)
  const active = Math.min(Math.max(link.active ?? 0, 0), mode.boardCount - 1)
  writer.writeBits(active, ACTIVE_BITS)
  writer.writeBits(flagsByte(link.d), DISPLAY_FLAGS_BITS)
  for (const board of boards) {
    encodeBoard(writer, board)
  }
  return writer.getBytes()
}

function decodeBoard(reader: BitReader): BoardState | null {
  const mapId = reader.readBits(MAP_ID_BITS)
  let mapKey: string | undefined
  if (mapId !== 0) {
    mapKey = mapKeyByWireId(mapId)
    if (mapKey === undefined) return null
  }

  const bitmap = reader.readBits(SECTION_BITMAP_BITS)
  if ((bitmap & ~KNOWN_SECTIONS) !== 0) return null

  const board: BoardState = {}
  if (mapKey !== undefined) board.m = mapKey

  if (bitmap & SECTION_TILES) {
    const count = reader.readBits(TILE_COUNT_BITS)
    board.t = []
    for (let i = 0; i < count; i++) {
      board.t.push([reader.readBits(HEX_ID_BITS), reader.readBits(TILE_STATE_BITS)])
    }
  }

  if (bitmap & SECTION_CHARACTERS) {
    const count = reader.readBits(CHARACTER_COUNT_BITS)
    board.c = []
    for (let i = 0; i < count; i++) {
      board.c.push([
        reader.readBits(HEX_ID_BITS),
        reader.readBits(CHARACTER_ID_BITS),
        reader.readBits(TEAM_BITS) + 1,
      ])
    }
  }

  if (bitmap & SECTION_ARTIFACTS) {
    const ally = reader.readBits(ARTIFACT_BITS)
    const enemy = reader.readBits(ARTIFACT_BITS)
    board.a = [ally === 0 ? null : ally, enemy === 0 ? null : enemy]
  }

  if (bitmap & SECTION_PHANTIMALS) {
    const count = reader.readBits(PHANTIMAL_COUNT_BITS)
    board.s = []
    for (let i = 0; i < count; i++) {
      board.s.push([
        reader.readBits(HEX_ID_BITS),
        reader.readBits(PHANTIMAL_ID_BITS),
        reader.readBits(TEAM_BITS) + 1,
      ])
    }
  }

  if (bitmap & SECTION_SYNERGY) {
    const count = reader.readBits(SYNERGY_COUNT_BITS)
    board.y = []
    for (let i = 0; i < count; i++) {
      board.y.push([
        reader.readBits(HEX_ID_BITS),
        reader.readBits(CHARACTER_ID_BITS),
        reader.readBits(TEAM_BITS) + 1,
      ])
    }
  }

  if (bitmap & SECTION_UPGRADES) {
    const count = reader.readBits(UPGRADE_COUNT_BITS)
    board.u = []
    for (let i = 0; i < count; i++) {
      board.u.push([
        reader.readBits(TEAM_BITS) + 1,
        reader.readBits(CHARACTER_ID_BITS),
        reader.readBits(ATTR_ID_BITS),
        reader.readBits(ATTR_VALUE_BITS),
      ])
    }
  }

  return board
}

// Silent on failure by design: during the shim window this decoder is the
// first probe for payloads that may legitimately be another format.
export function decodeLink(bytes: Uint8Array): BinaryLinkState | null {
  if (!bytes || bytes.length === 0) return null
  try {
    const reader = new BitReader(bytes)
    const mode = wireModeById(reader.readBits(MODE_BITS))
    if (!mode) return null
    const active = Math.min(reader.readBits(ACTIVE_BITS), mode.boardCount - 1)
    const d = reader.readBits(DISPLAY_FLAGS_BITS)

    const boards: BoardState[] = []
    for (let i = 0; i < mode.boardCount; i++) {
      const board = decodeBoard(reader)
      if (board === null) return null
      boards.push(board)
    }

    if (!reader.atCleanEnd()) return null
    return { mode: mode.key, active, d, boards }
  } catch {
    return null
  }
}

// Base64-like encoding optimized for URL use
// Uses URL-safe characters and avoids padding to minimize URL length
// This gives us 6 bits per character, making URLs ~33% longer than raw binary
const URL_SAFE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function bytesToUrlSafe(bytes: Uint8Array): string {
  let result = ''
  let bits = 0
  let bitCount = 0

  for (const byte of bytes) {
    bits = (bits << 8) | byte
    bitCount += 8

    while (bitCount >= 6) {
      bitCount -= 6
      const index = (bits >> bitCount) & 0x3f
      result += URL_SAFE_CHARS[index]
    }
  }

  // Handle remaining bits
  if (bitCount > 0) {
    const index = (bits << (6 - bitCount)) & 0x3f
    result += URL_SAFE_CHARS[index]
  }

  return result
}

export function urlSafeToBytes(str: string): Uint8Array | null {
  // Handle empty string as valid (empty state)
  if (!str || str.length === 0) {
    return new Uint8Array([])
  }

  const bytes: number[] = []
  let bits = 0
  let bitCount = 0

  for (const char of str) {
    const index = URL_SAFE_CHARS.indexOf(char)
    if (index === -1) {
      console.error('Invalid character in URL-safe string:', char)
      return null
    }

    bits = (bits << 6) | index
    bitCount += 6

    while (bitCount >= 8) {
      bitCount -= 8
      bytes.push((bits >> bitCount) & 0xff)
    }
  }

  return new Uint8Array(bytes)
}
