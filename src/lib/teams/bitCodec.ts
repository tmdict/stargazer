/* The pieces every link codec shares: bit-sequential reading and writing
 * (LSB-first), the range check for a value headed into a bit field, and the
 * URL-safe text form of the bytes. Each codec owns only its own layout. */

// Integers only: writeBits truncates fractions the same way it truncates
// oversized values, silently aliasing them to a different id on decode.
export const inRange = (value: unknown, min: number, max: number): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

export class BitWriter {
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
    if (this.bitPosition > 0) {
      this.buffer.push(this.currentByte)
    }
    return new Uint8Array(this.buffer)
  }
}

export class BitReader {
  private position = 0

  constructor(private bytes: Uint8Array) {}

  readBits(bitCount: number): number {
    let value = 0
    for (let i = 0; i < bitCount; i++) {
      const byteIndex = Math.floor((this.position + i) / 8)
      const bitIndex = (this.position + i) % 8
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

// Unpadded base64url: six bits a character, so the text is a third longer
// than the bytes.
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

  if (bitCount > 0) {
    const index = (bits << (6 - bitCount)) & 0x3f
    result += URL_SAFE_CHARS[index]
  }

  return result
}

export function urlSafeToBytes(str: string): Uint8Array | null {
  if (!str) {
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
