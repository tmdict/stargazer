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
 *   - Bits 5-6: Map ID (1-3, 0 means default/arena1)
 *   - Bit 7: Reserved
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

      const bit = (this.bytes[byteIndex] >> bitIndex) & 1
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
  const writer = new BitWriter()

  const tileCount = state.t?.length || 0
  const charCount = state.c?.length || 0
  const hasArtifacts = state.a !== undefined
  const hasDisplayFlags = state.d !== undefined
  // Check if we need extended header (for counts or display flags)
  const needsExtendedCounts = tileCount > 7 || charCount > 7
  const needsExtended = needsExtendedCounts || hasDisplayFlags

  // Write header byte
  let header = 0
  header |= Math.min(tileCount, 7) & 0x07 // Bits 0-2
  header |= (Math.min(charCount, 7) & 0x07) << 3 // Bits 3-5
  header |= hasArtifacts ? 0x40 : 0 // Bit 6
  header |= needsExtended ? 0x80 : 0 // Bit 7
  writer.writeBits(header, 8)

  // Write extended header if needed
  if (needsExtended) {
    // Extended flags byte
    let extendedFlags = 0
    if (needsExtendedCounts) {
      extendedFlags |= 0x01 // Bit 0: needs extended counts
    }
    if (hasDisplayFlags && state.d !== undefined) {
      // Pack display flags into bits 1-4
      extendedFlags |= (state.d & 0x0f) << 1
    }
    writer.writeBits(extendedFlags, 8)

    // Write extended counts if needed
    if (needsExtendedCounts) {
      const extendedTileCount = Math.max(0, tileCount - 7)
      const extendedCharCount = Math.max(0, charCount - 7)
      writer.writeBits(extendedTileCount, 8) // Full byte for additional tiles
      writer.writeBits(extendedCharCount, 8) // Full byte for additional characters
    }
  }

  // Write tiles
  if (state.t) {
    for (const [hexId, stateValue] of state.t) {
      writer.writeBits(hexId, HEX_ID_BITS) // Hex ID
      writer.writeBits(stateValue, TILE_STATE_BITS) // State
    }
  }

  // Write characters with fixed 14-bit encoding
  if (state.c) {
    for (const [hexId, charId, team] of state.c) {
      // Validate character ID fits within our encoding limit
      if (charId > MAX_CHARACTER_ID) {
        console.warn(
          `Character ID ${charId} exceeds maximum ${MAX_CHARACTER_ID}, encoding will be truncated`,
        )
      }

      writer.writeBits(hexId, HEX_ID_BITS) // Hex ID
      writer.writeBits(charId & MAX_CHARACTER_ID, CHARACTER_ID_BITS) // Character ID (14 bits)

      // Convert Team enum to bit value: 1 (ALLY) -> 0, 2 (ENEMY) -> 1
      const teamBit = team - 1
      writer.writeBits(teamBit, TEAM_BITS) // Team
    }
  }

  // Write artifacts
  if (hasArtifacts && state.a) {
    const [ally, enemy] = state.a
    writer.writeBits(ally || 0, ARTIFACT_BITS) // Ally artifact
    writer.writeBits(enemy || 0, ARTIFACT_BITS) // Enemy artifact
  }

  return writer.getBytes()
}

export function decodeFromBinary(bytes: Uint8Array): GridState | null {
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
      const displayFlags = (extendedFlags >> 1) & 0x0f
      if (displayFlags !== 0 || extendedFlags > 0) {
        // Only set display flags if they were explicitly stored
        state.d = displayFlags
      }

      // Read extended counts if present
      if (needsExtendedCounts) {
        const extendedTileCount = reader.readBits(8) // Full byte for additional tiles
        const extendedCharCount = reader.readBits(8) // Full byte for additional characters
        tileCount += extendedTileCount
        charCount += extendedCharCount
      }
    }

    // Read tiles
    if (tileCount > 0) {
      state.t = []
      for (let i = 0; i < tileCount; i++) {
        const hexId = reader.readBits(HEX_ID_BITS)
        const stateValue = reader.readBits(TILE_STATE_BITS)
        state.t.push([hexId, stateValue])
      }
    }

    // Read characters with fixed 14-bit decoding
    if (charCount > 0) {
      state.c = []
      for (let i = 0; i < charCount; i++) {
        const hexId = reader.readBits(HEX_ID_BITS)
        const charId = reader.readBits(CHARACTER_ID_BITS) // Fixed 14 bits
        const teamBit = reader.readBits(TEAM_BITS)
        // Convert bit value to Team enum: 0 -> 1 (ALLY), 1 -> 2 (ENEMY)
        const team = teamBit + 1
        state.c.push([hexId, charId, team])
      }
    }

    // Read artifacts
    if (hasArtifacts) {
      const ally = reader.readBits(ARTIFACT_BITS)
      const enemy = reader.readBits(ARTIFACT_BITS)
      state.a = [ally === 0 ? null : ally, enemy === 0 ? null : enemy]
    }

    return state
  } catch (error) {
    console.error('Binary decode error:', error)
    return null
  }
}

// Base64-like encoding optimized for URL use
// Uses URL-safe characters and avoids padding
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
