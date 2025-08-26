import type { GridState } from './gridStateSerializer'

// Character ID encoding constants
const CHARACTER_ID_BITS = 14 // Supports IDs 0-16383
const MAX_CHARACTER_ID = (1 << CHARACTER_ID_BITS) - 1 // 16383
const HEX_ID_BITS = 6 // Supports hex IDs 0-63
const TILE_STATE_BITS = 3 // Supports states 0-7
const TEAM_BITS = 1 // Supports 2 teams
const ARTIFACT_BITS = 3 // Supports artifact IDs 0-7

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
 *   - Bits 1-4: Display flags (showHexIds, showArrows, showPerspective, showSkills)
 *   - Bits 5-7: Reserved (not currently used)
 * - If bit 0 of extended flags is set:
 *   - Next byte: Additional tile count (0-255, add to first 7)
 *   - Next byte: Additional character count (0-255, add to first 7)
 *
 * Tile entry (9 bits):
 * - Bits 0-5: Hex ID (6 bits, supports 1-63)
 * - Bits 6-8: State (3 bits, supports 0-7)
 *
 * Character entry (21 bits):
 * - Bits 0-5: Hex ID (6 bits)
 * - Bits 6-19: Character ID (14 bits, supports 0-16383)
 * - Bit 20: Team (1 bit)
 *
 * Note: Character IDs are currently limited to 16383 (14 bits).
 * If future expansion is needed beyond this limit, a new encoding
 * format with a flag bit can be introduced while maintaining
 * backward compatibility.
 *
 * Artifacts (6 bits):
 * - Bits 0-2: Ally artifact (3 bits, 0 = null, 1-7 = artifact ID)
 * - Bits 3-5: Enemy artifact (3 bits, 0 = null, 1-7 = artifact ID)
 */

/**
 * Validates and filters grid state to ensure all values are within valid ranges.
 * This prevents encoding errors and ensures encoder/decoder stay in sync.
 *
 * @param state - The grid state to validate
 * @returns A new grid state with only valid entries
 */
export function validateGridState(state: GridState): GridState {
  const validated: GridState = {}

  // Validate tile entries: hexId must be 1-63, state must be 0-7
  // We filter out invalid entries to ensure the count matches actual data written
  if (state.t) {
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

  // Validate character entries: hexId 1-63, charId 1-16383, team 1-2
  // This ensures character IDs fit in 14 bits and teams in 1 bit
  if (state.c) {
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

  // Artifacts: keep as-is (null or 0-7 range is handled during encoding)
  if (state.a !== undefined) {
    validated.a = state.a
  }

  // Display flags: keep as-is (4-bit value is masked during encoding)
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

  hasMoreData(): boolean {
    return Math.floor(this.position / 8) < this.bytes.length
  }
}

export function encodeToBinary(state: GridState): Uint8Array {
  // Validate and filter input to ensure all values are within valid ranges
  // This prevents the count mismatch bug where invalid entries were skipped
  const validState = validateGridState(state)

  const writer = new BitWriter()

  // Now we can safely use the lengths since all entries are valid
  const tileCount = validState.t?.length || 0
  const charCount = validState.c?.length || 0
  const hasArtifacts = validState.a !== undefined
  const hasDisplayFlags = validState.d !== undefined

  // Extended header is needed if we have >7 entries OR display flags
  // This optimization keeps URLs short for small grids
  const needsExtendedCounts = tileCount > 7 || charCount > 7
  const needsExtended = needsExtendedCounts || hasDisplayFlags

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
    // Bits 1-4: display flags (4 bits for showHexIds, showArrows, showPerspective, showSkills)
    // Bits 5-7: reserved for future use
    let extendedFlags = 0
    if (needsExtendedCounts) {
      extendedFlags |= 0x01 // Bit 0: needs extended counts
    }
    if (hasDisplayFlags && validState.d !== undefined) {
      // Pack display flags into bits 1-4
      // Only the lower 4 bits of d are used (one bit per flag)
      extendedFlags |= (validState.d & 0x0f) << 1
    }
    writer.writeBits(extendedFlags, 8)

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
      const charId = entry[1]! // Guaranteed valid (1-16383) by validation
      const team = entry[2]! // Guaranteed valid (1 or 2) by validation

      writer.writeBits(hexId, HEX_ID_BITS) // 6 bits for hex ID
      writer.writeBits(charId, CHARACTER_ID_BITS) // 14 bits for character ID

      // Convert Team enum to bit value: Team.ALLY (1) -> 0, Team.ENEMY (2) -> 1
      // This saves 1 bit per character entry
      const teamBit = team - 1
      writer.writeBits(teamBit, TEAM_BITS) // 1 bit for team
    }
  }

  // Write artifacts (6 bits total: 3 bits per artifact)
  if (hasArtifacts && validState.a) {
    // 0 represents null/no artifact, 1-7 are valid artifact IDs
    const ally = validState.a[0] ?? 0 // null -> 0
    const enemy = validState.a[1] ?? 0 // null -> 0
    writer.writeBits(ally, ARTIFACT_BITS) // 3 bits for ally artifact
    writer.writeBits(enemy, ARTIFACT_BITS) // 3 bits for enemy artifact
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

    // Read extended header if present
    if (hasExtended) {
      // Read extended flags byte
      const extendedFlags = reader.readBits(8)
      const needsExtendedCounts = (extendedFlags & 0x01) !== 0

      // Extract display flags from bits 1-4
      // IMPORTANT: Only set display flags if they were explicitly encoded
      // This fixes the bug where d=0 was incorrectly set when only extended counts were present
      const displayFlagBits = (extendedFlags >> 1) & 0x0f

      // Display flags are present if:
      // 1. We have display flag bits set (non-zero), OR
      // 2. We have extended header WITHOUT extended counts (display-only header)
      const hasDisplayFlags = displayFlagBits !== 0 || !needsExtendedCounts

      if (hasDisplayFlags) {
        // Set display flags (including 0 if explicitly stored)
        state.d = displayFlagBits
      }
      // If no display flags were encoded, state.d remains undefined (as intended)

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

    // Read characters (each character is 21 bits: 6 + 14 + 1)
    if (charCount > 0) {
      state.c = []
      for (let i = 0; i < charCount; i++) {
        const hexId = reader.readBits(HEX_ID_BITS) // 6 bits
        const charId = reader.readBits(CHARACTER_ID_BITS) // 14 bits (max 16383)
        const teamBit = reader.readBits(TEAM_BITS) // 1 bit

        // Convert bit value back to Team enum: 0 -> Team.ALLY (1), 1 -> Team.ENEMY (2)
        const team = teamBit + 1
        state.c.push([hexId, charId, team])
      }
    }

    // Read artifacts (6 bits total)
    if (hasArtifacts) {
      const ally = reader.readBits(ARTIFACT_BITS) // 3 bits
      const enemy = reader.readBits(ARTIFACT_BITS) // 3 bits

      // Convert 0 back to null (no artifact), 1-7 are artifact IDs
      state.a = [ally === 0 ? null : ally, enemy === 0 ? null : enemy]
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
