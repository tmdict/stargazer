import type { GridState } from './gridStateSerializer'

// Character ID encoding constants
const CHARACTER_ID_BITS = 16 // Supports IDs 0-65535 (covers companion IDs, see format note)
const MAX_CHARACTER_ID = (1 << CHARACTER_ID_BITS) - 1 // 65535
const HEX_ID_BITS = 6 // Supports hex IDs 0-63
const TILE_STATE_BITS = 3 // Supports states 0-7
const TEAM_BITS = 1 // Supports 2 teams
const ARTIFACT_BITS = 6 // Supports artifact IDs 0-63 (0 = null)
const MAX_ARTIFACT_ID = (1 << ARTIFACT_BITS) - 1 // 63
const PHANTIMAL_ID_BITS = 4 // Supports local phantimal IDs 1-15
const MAX_PHANTIMAL_ID = (1 << PHANTIMAL_ID_BITS) - 1 // 15
const PHANTIMAL_COUNT_BITS = 4 // Supports up to 15 phantimal entries
const MAX_PHANTIMAL_COUNT = (1 << PHANTIMAL_COUNT_BITS) - 1 // 15
const PARAGON_LEVEL_BITS = 3 // Paragon levels 1-4 (0 = absent, never stored)
const MAX_PARAGON_LEVEL = (1 << PARAGON_LEVEL_BITS) - 1 // 7 (game caps levels at 4)
const PARAGON_COUNT_BITS = 5 // Supports up to 31 paragon entries
const MAX_PARAGON_COUNT = (1 << PARAGON_COUNT_BITS) - 1 // 31

/**
 * Binary encoding utilities for ultra-compact URL serialization
 *
 * Binary Format Specification:
 *
 * Header byte (8 bits):
 * - Bits 0-2: Number of tile entries (0-7)
 * - Bits 3-5: Number of character entries (0-7)
 * - Bit 6: Has artifacts (0/1)
 * - Bit 7: Extended mode for 8+ entries or has display flags
 *
 * Extended header (if bit 7 is set):
 * - Next byte: Extended flags byte
 *   - Bit 0: Actually needs extended counts (not just display flags)
 *   - Bit 1: Has paragon (paragon section present after phantimals)
 *   - Bits 2-5: reserved
 *   - Bit 6: Has phantimals (phantimal section present after artifacts)
 *   - Bit 7: Has display flags (a dedicated display-flags byte follows)
 * - If bit 7 of extended flags is set:
 *   - Next byte: Display flags (bit 0 showGridInfo, 1 showArrows, 2 showPerspective,
 *     3 showSkills, 4 teamView, 5 inverted, 6 wrap; bit 7 spare)
 * - If bit 0 of extended flags is set:
 *   - Next byte: Additional tile count (0-255, add to first 7)
 *   - Next byte: Additional character count (0-255, add to first 7)
 *
 * Tile entry (9 bits):
 * - Bits 0-5: Hex ID (6 bits, supports 1-63)
 * - Bits 6-8: State (3 bits, supports 0-7)
 *
 * Character entry (23 bits):
 * - Bits 0-5: Hex ID (6 bits)
 * - Bits 6-21: Character ID (16 bits, supports 0-65535)
 * - Bit 22: Team (1 bit)
 *
 * Note: This field also carries companion IDs (N * companionIdOffset + base, see
 * grid.ts), which the restore path uses to reposition companions after their main
 * character is placed. 16 bits covers companion index N up to 6 for base IDs below
 * 5536. Phantimal IDs (100000+) never reach this field; they serialize via their
 * 4-bit local ID below.
 *
 * Artifacts (12 bits):
 * - Bits 0-5: Ally artifact (6 bits, 0 = null, 1-63 = artifact ID)
 * - Bits 6-11: Enemy artifact (6 bits, 0 = null, 1-63 = artifact ID)
 *
 * Phantimals (only if extended flag bit 6 is set, written after artifacts):
 * - Count (4 bits, 0-15)
 * - Each entry (11 bits): hexId (6) + local phantimal ID (4) + team (1)
 *
 * Paragon (only if extended flag bit 1 is set, written after phantimals):
 * - Count (5 bits, 0-31)
 * - Each entry (20 bits): team (1) + characterId (16) + level (3)
 */

/**
 * Validates and filters grid state to ensure all values are within valid ranges.
 * This prevents encoding errors and ensures encoder/decoder stay in sync.
 *
 * @param state - The grid state to validate
 * @returns A new grid state with only valid entries
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
    const validTiles = state.t.filter((entry) => {
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
    if (validTiles.length > 0) {
      validated.t = validTiles
    }
  }

  // Validate character entries: hexId 1-63, charId 1-65535, team 1-2
  // This ensures character IDs fit in 16 bits and teams in 1 bit
  if (state.c && Array.isArray(state.c)) {
    const validChars = state.c.filter((entry) => {
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
  if (state.p && Array.isArray(state.p)) {
    let validPhantimals = state.p.filter((entry) => {
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
    // Cap at the 4-bit count field's maximum; a longer list would wrap the
    // encoded count and desync the decoder.
    if (validPhantimals.length > MAX_PHANTIMAL_COUNT) {
      console.warn(
        `Too many phantimal entries (${validPhantimals.length}), keeping first ${MAX_PHANTIMAL_COUNT}`,
      )
      validPhantimals = validPhantimals.slice(0, MAX_PHANTIMAL_COUNT)
    }
    if (validPhantimals.length > 0) {
      validated.p = validPhantimals
    }
  }

  // Validate paragon entries: team 1-2, charId 1-65535, level 1-7
  if (state.pr && Array.isArray(state.pr)) {
    let validParagons = state.pr.filter((entry) => {
      const [team, charId, level] = entry
      const isValid =
        (team === 1 || team === 2) &&
        charId != null &&
        charId > 0 &&
        charId <= MAX_CHARACTER_ID &&
        level != null &&
        level > 0 &&
        level <= MAX_PARAGON_LEVEL
      if (!isValid) {
        console.warn('Invalid paragon entry:', entry)
      }
      return isValid
    })
    // Cap at the count field's maximum so the encoded count can't wrap.
    if (validParagons.length > MAX_PARAGON_COUNT) {
      console.warn(
        `Too many paragon entries (${validParagons.length}), keeping first ${MAX_PARAGON_COUNT}`,
      )
      validParagons = validParagons.slice(0, MAX_PARAGON_COUNT)
    }
    if (validParagons.length > 0) {
      validated.pr = validParagons
    }
  }

  // Display flags: keep as-is (stored in a dedicated byte during encoding)
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
}

export function encodeToBinary(state: GridState): Uint8Array {
  // Validate and filter input before counting, so the encoded counts always
  // match the entries actually written
  const validState = validateGridState(state)

  const writer = new BitWriter()

  // Now we can safely use the lengths since all entries are valid
  const tileCount = validState.t?.length || 0
  const charCount = validState.c?.length || 0
  const hasArtifacts = validState.a !== undefined
  const hasDisplayFlags = validState.d !== undefined
  const hasPhantimals = validState.p !== undefined && validState.p.length > 0
  const hasParagon = validState.pr !== undefined && validState.pr.length > 0

  // Extended header is needed if we have >7 entries OR display flags OR phantimals
  // OR paragon. This optimization keeps URLs short for small grids
  const needsExtendedCounts = tileCount > 7 || charCount > 7
  const needsExtended = needsExtendedCounts || hasDisplayFlags || hasPhantimals || hasParagon

  // Write header byte (8 bits total)
  let header = 0
  header |= Math.min(tileCount, 7) & 0x07 // Bits 0-2: tile count (0-7)
  header |= (Math.min(charCount, 7) & 0x07) << 3 // Bits 3-5: character count (0-7)
  header |= hasArtifacts ? 0x40 : 0 // Bit 6: has artifacts flag
  header |= needsExtended ? 0x80 : 0 // Bit 7: extended header flag
  writer.writeBits(header, 8)

  // Write extended header if needed (for 8+ entries or display flags)
  if (needsExtended) {
    // Extended flags byte layout:
    // Bit 0: needs extended counts (1 if >7 entries)
    // Bit 1: has paragon
    // Bits 2-5: reserved
    // Bit 6: has phantimals
    // Bit 7: has display flags (a dedicated byte follows; lets an explicit d=0 round-trip)
    let extendedFlags = 0
    if (needsExtendedCounts) {
      extendedFlags |= 0x01 // Bit 0: needs extended counts
    }
    if (hasDisplayFlags) {
      extendedFlags |= 0x80 // Bit 7: display flags present
    }
    if (hasPhantimals) {
      extendedFlags |= 0x40 // Bit 6: has phantimals
    }
    if (hasParagon) {
      extendedFlags |= 0x02 // Bit 1: has paragon
    }
    writer.writeBits(extendedFlags, 8)

    // Dedicated display-flags byte (one bit per toggle; see format note)
    if (hasDisplayFlags && validState.d !== undefined) {
      writer.writeBits(validState.d & 0xff, 8)
    }

    // Write extended counts if needed (supports up to 262 total entries: 7 + 255)
    if (needsExtendedCounts) {
      const extendedTileCount = Math.max(0, tileCount - 7)
      const extendedCharCount = Math.max(0, charCount - 7)
      writer.writeBits(extendedTileCount, 8) // Additional tiles beyond first 7
      writer.writeBits(extendedCharCount, 8) // Additional characters beyond first 7
    }
  }

  // Write tiles (already validated, so no need to check or skip)
  if (validState.t) {
    for (const entry of validState.t) {
      const hexId = entry[0]! // Guaranteed valid (1-63) by validation
      const stateValue = entry[1]! // Guaranteed valid (0-7) by validation

      writer.writeBits(hexId, HEX_ID_BITS) // 6 bits for hex ID
      writer.writeBits(stateValue, TILE_STATE_BITS) // 3 bits for state
    }
  }

  // Write characters (already validated, so all values are guaranteed valid)
  if (validState.c) {
    for (const entry of validState.c) {
      const hexId = entry[0]! // Guaranteed valid (1-63) by validation
      const charId = entry[1]! // Guaranteed valid (1-65535) by validation
      const team = entry[2]! // Guaranteed valid (1 or 2) by validation

      writer.writeBits(hexId, HEX_ID_BITS) // 6 bits for hex ID
      writer.writeBits(charId, CHARACTER_ID_BITS) // 16 bits for character ID

      // Convert Team enum to bit value: Team.ALLY (1) -> 0, Team.ENEMY (2) -> 1
      // This saves 1 bit per character entry
      const teamBit = team - 1
      writer.writeBits(teamBit, TEAM_BITS) // 1 bit for team
    }
  }

  // Write artifacts (12 bits total: 6 bits per artifact)
  if (hasArtifacts && validState.a) {
    // 0 represents null/no artifact, 1-63 are valid artifact IDs
    const ally = validState.a[0] ?? 0 // null -> 0
    const enemy = validState.a[1] ?? 0 // null -> 0
    writer.writeBits(ally, ARTIFACT_BITS) // 6 bits for ally artifact
    writer.writeBits(enemy, ARTIFACT_BITS) // 6 bits for enemy artifact
  }

  // Write phantimals (after artifacts): count, then hexId + local id + team each
  if (hasPhantimals && validState.p) {
    writer.writeBits(validState.p.length, PHANTIMAL_COUNT_BITS)
    for (const entry of validState.p) {
      const hexId = entry[0]! // Guaranteed valid (1-63) by validation
      const localId = entry[1]! // Guaranteed valid (1-15) by validation
      const team = entry[2]! // Guaranteed valid (1 or 2) by validation

      writer.writeBits(hexId, HEX_ID_BITS) // 6 bits for hex ID
      writer.writeBits(localId, PHANTIMAL_ID_BITS) // 4 bits for local phantimal ID
      writer.writeBits(team - 1, TEAM_BITS) // 1 bit for team
    }
  }

  // Write paragon (after phantimals): count, then team + character ID + level each
  if (hasParagon && validState.pr) {
    writer.writeBits(validState.pr.length, PARAGON_COUNT_BITS)
    for (const entry of validState.pr) {
      const team = entry[0]! // Guaranteed valid (1 or 2) by validation
      const charId = entry[1]! // Guaranteed valid (1-65535) by validation
      const level = entry[2]! // Guaranteed valid (1-7) by validation

      writer.writeBits(team - 1, TEAM_BITS) // 1 bit for team
      writer.writeBits(charId, CHARACTER_ID_BITS) // 16 bits for character ID
      writer.writeBits(level, PARAGON_LEVEL_BITS) // 3 bits for paragon level
    }
  }

  return writer.getBytes()
}

export function decodeFromBinary(bytes: Uint8Array): GridState | null {
  // Handle empty input gracefully - return empty state instead of error
  if (!bytes || bytes.length === 0) {
    return {} // Empty grid state
  }

  // Special case: single zero byte represents empty state (optimization)
  if (bytes.length === 1 && bytes[0] === 0) {
    return {}
  }

  try {
    const reader = new BitReader(bytes)
    const state: GridState = {}

    // Read header
    const header = reader.readBits(8)
    let tileCount = header & 0x07 // Bits 0-2
    let charCount = (header >> 3) & 0x07 // Bits 3-5
    const hasArtifacts = (header & 0x40) !== 0 // Bit 6
    const hasExtended = (header & 0x80) !== 0 // Bit 7

    // Phantimals / paragon can be the sole reason for an extended header; track
    // them so the sections after artifacts are read.
    let hasPhantimals = false
    let hasParagon = false

    // Read extended header if present
    if (hasExtended) {
      // Read extended flags byte
      const extendedFlags = reader.readBits(8)
      const needsExtendedCounts = (extendedFlags & 0x01) !== 0
      hasPhantimals = (extendedFlags & 0x40) !== 0 // Bit 6
      hasParagon = (extendedFlags & 0x02) !== 0 // Bit 1

      // Bit 7 explicitly marks display flags as present, so d=0 (all flags off)
      // is distinguishable from "no display flags encoded" (d stays undefined).
      if ((extendedFlags & 0x80) !== 0) {
        state.d = reader.readBits(8) // dedicated display-flags byte
      }

      // Read extended counts if present
      if (needsExtendedCounts) {
        const extendedTileCount = reader.readBits(8) // Additional tiles beyond 7
        const extendedCharCount = reader.readBits(8) // Additional characters beyond 7
        tileCount += extendedTileCount
        charCount += extendedCharCount
      }
    }

    // Read tiles (each tile is 9 bits: 6 for hexId, 3 for state)
    if (tileCount > 0) {
      state.t = []
      for (let i = 0; i < tileCount; i++) {
        const hexId = reader.readBits(HEX_ID_BITS) // 6 bits
        const stateValue = reader.readBits(TILE_STATE_BITS) // 3 bits
        state.t.push([hexId, stateValue])
      }
    }

    // Read characters (each character is 23 bits: 6 + 16 + 1)
    if (charCount > 0) {
      state.c = []
      for (let i = 0; i < charCount; i++) {
        const hexId = reader.readBits(HEX_ID_BITS) // 6 bits
        const charId = reader.readBits(CHARACTER_ID_BITS) // 16 bits (max 65535)
        const teamBit = reader.readBits(TEAM_BITS) // 1 bit

        // Convert bit value back to Team enum: 0 -> Team.ALLY (1), 1 -> Team.ENEMY (2)
        const team = teamBit + 1
        state.c.push([hexId, charId, team])
      }
    }

    // Read artifacts (ARTIFACT_BITS each for ally and enemy)
    if (hasArtifacts) {
      const ally = reader.readBits(ARTIFACT_BITS)
      const enemy = reader.readBits(ARTIFACT_BITS)

      // Convert 0 back to null (no artifact), 1-63 are artifact IDs
      state.a = [ally === 0 ? null : ally, enemy === 0 ? null : enemy]
    }

    // Read phantimals (after artifacts) if the extended flag marked them present
    if (hasPhantimals) {
      const phantimalCount = reader.readBits(PHANTIMAL_COUNT_BITS)
      if (phantimalCount > 0) {
        state.p = []
        for (let i = 0; i < phantimalCount; i++) {
          const hexId = reader.readBits(HEX_ID_BITS) // 6 bits
          const localId = reader.readBits(PHANTIMAL_ID_BITS) // 4 bits
          const teamBit = reader.readBits(TEAM_BITS) // 1 bit
          state.p.push([hexId, localId, teamBit + 1])
        }
      }
    }

    // Read paragon (after phantimals) if the extended flag marked it present
    if (hasParagon) {
      const paragonCount = reader.readBits(PARAGON_COUNT_BITS)
      if (paragonCount > 0) {
        state.pr = []
        for (let i = 0; i < paragonCount; i++) {
          const teamBit = reader.readBits(TEAM_BITS) // 1 bit
          const charId = reader.readBits(CHARACTER_ID_BITS) // 16 bits
          const level = reader.readBits(PARAGON_LEVEL_BITS) // 3 bits
          state.pr.push([teamBit + 1, charId, level])
        }
      }
    }

    return state
  } catch (error) {
    // Log error with context for easier debugging
    console.error('Binary decode error:', error)
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
