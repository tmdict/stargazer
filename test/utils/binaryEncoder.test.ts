import { describe, expect, it, vi } from 'vitest'

import {
  bytesToUrlSafe,
  decodeFromBinary,
  encodeToBinary,
  urlSafeToBytes,
  validateGridState,
} from '../../src/utils/binaryEncoder'
import type { GridState } from '../../src/utils/gridStateSerializer'

describe('binaryEncoder', () => {
  describe('encodeToBinary and decodeFromBinary', () => {
    it('encodes and decodes empty state', () => {
      const state: GridState = {}
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes state with only tiles', () => {
      const state: GridState = {
        t: [
          [1, 2], // hex 1, state 2
          [5, 3], // hex 5, state 3
          [10, 1], // hex 10, state 1
        ],
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes state with only characters', () => {
      const state: GridState = {
        c: [
          [1, 100, 1], // hex 1, character 100, team ALLY (1)
          [5, 200, 2], // hex 5, character 200, team ENEMY (2)
          [10, 10001, 1], // hex 10, companion 10001, team ALLY
        ],
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes state with only artifacts', () => {
      const state: GridState = {
        a: [3, 5], // ally artifact 3, enemy artifact 5
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes state with null artifacts', () => {
      const state: GridState = {
        a: [null, 5], // no ally artifact, enemy artifact 5
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual({ a: [null, 5] })
    })

    it('encodes and decodes state with both null artifacts', () => {
      const state: GridState = {
        a: [null, null],
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual({ a: [null, null] })
    })

    it('encodes and decodes full state with all components', () => {
      const state: GridState = {
        t: [
          [1, 2],
          [5, 3],
        ],
        c: [
          [2, 100, 1],
          [6, 200, 2],
        ],
        a: [2, 4],
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes display flags', () => {
      const state: GridState = {
        t: [[1, 1]],
        d: 0b1010, // showArrows and showSkills true
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes display flags with value 0', () => {
      const state: GridState = {
        t: [[1, 1]],
        d: 0, // All flags false
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      // With explicit d=0, extended header is created just for display flags
      expect(decoded).toEqual({
        t: [[1, 1]],
        d: 0, // Display flags are preserved
      })
    })

    it('handles extended header for 8+ tile entries', () => {
      const state: GridState = {
        t: Array.from({ length: 10 }, (_, i) => [i + 1, 1]),
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded?.t).toHaveLength(10)
      // Fixed: display flags are NOT set when not provided
      expect(decoded).toEqual(state)
      expect(decoded?.d).toBeUndefined()
    })

    it('handles extended header for 8+ character entries', () => {
      const state: GridState = {
        c: Array.from({ length: 12 }, (_, i) => [i + 1, 100 + i, (i % 2) + 1]),
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded?.c).toHaveLength(12)
      // Fixed: display flags are NOT set when not provided
      expect(decoded).toEqual(state)
      expect(decoded?.d).toBeUndefined()
    })

    it('handles maximum of 262 tiles (7 + 255)', () => {
      const maxTiles = 7 + 255 // 262 is actual max (7 in header + 255 in extended)
      const state: GridState = {
        t: Array.from({ length: maxTiles }, (_, i) => [(i % 63) + 1, (i % 7) + 1]),
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded?.t).toHaveLength(maxTiles)
      expect(decoded?.d).toBeUndefined() // Display flags not set when not provided
    })

    it('handles maximum of 262 characters (7 + 255)', () => {
      const maxChars = 7 + 255 // 262 is actual max (7 in header + 255 in extended)
      const state: GridState = {
        c: Array.from({ length: maxChars }, (_, i) => [(i % 63) + 1, (i % 1000) + 1, (i % 2) + 1]),
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded?.c).toHaveLength(maxChars)
      expect(decoded?.d).toBeUndefined() // Display flags not set when not provided
    })

    it('handles character IDs at the maximum limit (16383)', () => {
      const state: GridState = {
        c: [
          [1, 16383, 1], // Max character ID
          [2, 1, 2],
          [3, 10000, 1],
        ],
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual(state)
    })

    it('filters character IDs exceeding maximum', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const state: GridState = {
        c: [[1, 20000, 1]], // Exceeds max of 16383 - will be filtered out
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      // Character is filtered out during validation
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid character entry:',
        expect.objectContaining({
          charId: 20000,
          limits: expect.objectContaining({ maxCharId: 16383 }),
        }),
      )
      // No characters encoded since the only one was invalid
      expect(decoded?.c).toBeUndefined()

      consoleSpy.mockRestore()
    })

    it('filters invalid tile entries with validation', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const state: GridState = {
        t: [
          [1, 2],
          [undefined as unknown as number, 3], // Invalid entry - will be filtered
          [5, 4],
          [0, 2], // Invalid: hexId must be > 0
          [64, 3], // Invalid: hexId must be <= 63
        ],
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      // Only valid tiles are encoded and decoded
      expect(decoded?.t).toEqual([
        [1, 2],
        [5, 4],
      ])
      // Warnings are logged for invalid entries
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('filters invalid character entries with validation', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const state: GridState = {
        c: [
          [1, 100, 1],
          [undefined as unknown as number, 200, 2], // Invalid hexId
          [3, undefined as unknown as number, 1], // Invalid characterId
          [4, 300, undefined as unknown as number], // Invalid team
          [5, 400, 2],
          [6, 20000, 1], // Invalid: charId > MAX
          [7, 300, 3], // Invalid: team must be 1 or 2
        ],
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      // Only valid characters are encoded and decoded
      expect(decoded?.c).toEqual([
        [1, 100, 1],
        [5, 400, 2],
      ])
      // Warnings are logged for invalid entries
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles decoding invalid binary data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const invalidBytes = new Uint8Array([255, 255, 255, 255]) // Invalid data
      const decoded = decodeFromBinary(invalidBytes)

      expect(consoleSpy).toHaveBeenCalledWith('Binary decode error:', expect.anything())
      expect(decoded).toBeNull()

      consoleSpy.mockRestore()
    })

    it('handles decoding empty binary data', () => {
      const emptyBytes = new Uint8Array([])
      const decoded = decodeFromBinary(emptyBytes)

      // Fixed: empty input returns empty state, not null
      expect(decoded).toEqual({})
    })

    it('correctly converts team values between enum and bits', () => {
      const state: GridState = {
        c: [
          [1, 100, 1], // Team.ALLY (1) -> bit 0
          [2, 200, 2], // Team.ENEMY (2) -> bit 1
        ],
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded?.c).toEqual([
        [1, 100, 1],
        [2, 200, 2],
      ])
    })

    it('handles extended header with display flags but no extended counts', () => {
      const state: GridState = {
        t: [[1, 1]], // Only 1 tile
        c: [[2, 100, 1]], // Only 1 character
        d: 0b1111, // All display flags true
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded).toEqual(state)
    })

    it('handles extended header with both display flags and extended counts', () => {
      const state: GridState = {
        t: Array.from({ length: 10 }, (_, i) => [i + 1, 1]),
        c: Array.from({ length: 8 }, (_, i) => [i + 10, 100 + i, 1]),
        d: 0b0101, // Some display flags
      }
      const encoded = encodeToBinary(state)
      const decoded = decodeFromBinary(encoded)

      expect(decoded?.t).toHaveLength(10)
      expect(decoded?.c).toHaveLength(8)
      expect(decoded?.d).toBe(0b0101) // Display flags preserved when explicitly set
    })
  })

  describe('bytesToUrlSafe and urlSafeToBytes', () => {
    it('encodes and decodes bytes to URL-safe string', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5])
      const urlSafe = bytesToUrlSafe(bytes)
      const decoded = urlSafeToBytes(urlSafe)

      expect(decoded).toEqual(bytes)
    })

    it('handles empty bytes', () => {
      const bytes = new Uint8Array([])
      const urlSafe = bytesToUrlSafe(bytes)
      const decoded = urlSafeToBytes(urlSafe)

      expect(urlSafe).toBe('')
      expect(decoded).toEqual(bytes)
    })

    it('handles single byte', () => {
      const bytes = new Uint8Array([255])
      const urlSafe = bytesToUrlSafe(bytes)
      const decoded = urlSafeToBytes(urlSafe)

      expect(decoded).toEqual(bytes)
    })

    it('handles various byte lengths', () => {
      for (let length = 1; length <= 20; length++) {
        const bytes = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
          bytes[i] = Math.floor(Math.random() * 256)
        }
        const urlSafe = bytesToUrlSafe(bytes)
        const decoded = urlSafeToBytes(urlSafe)

        expect(decoded).toEqual(bytes)
      }
    })

    it('produces URL-safe characters only', () => {
      const bytes = new Uint8Array([0, 127, 255, 1, 2, 3])
      const urlSafe = bytesToUrlSafe(bytes)

      // Check that all characters are URL-safe
      const urlSafeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
      for (const char of urlSafe) {
        expect(urlSafeChars).toContain(char)
      }
    })

    it('handles invalid characters in URL-safe string', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const invalidString = 'ABC@DEF' // @ is not a valid URL-safe character
      const decoded = urlSafeToBytes(invalidString)

      expect(consoleSpy).toHaveBeenCalledWith('Invalid character in URL-safe string:', '@')
      expect(decoded).toBeNull()

      consoleSpy.mockRestore()
    })

    it('handles empty string decoding', () => {
      const decoded = urlSafeToBytes('')
      expect(decoded).toEqual(new Uint8Array([]))
    })

    it('handles all URL-safe characters', () => {
      const urlSafeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
      // Test that each character can be decoded
      for (const char of urlSafeChars) {
        const decoded = urlSafeToBytes(char)
        expect(decoded).not.toBeNull()
        // Some characters may decode to empty array due to incomplete byte
        expect(decoded).toBeInstanceOf(Uint8Array)
      }
    })

    it('maintains data integrity for large states', () => {
      const state: GridState = {
        t: Array.from({ length: 50 }, (_, i) => [i + 1, (i % 7) + 1]),
        c: Array.from({ length: 30 }, (_, i) => [i + 1, 1000 + i, (i % 2) + 1]),
        a: [3, 5],
        d: 0b1111,
      }

      const binaryData = encodeToBinary(state)
      const urlSafe = bytesToUrlSafe(binaryData)
      const decodedBytes = urlSafeToBytes(urlSafe)
      const decodedState = decodeFromBinary(decodedBytes!)

      expect(decodedState).toEqual(state)
    })
  })

  describe('validateGridState', () => {
    it('filters invalid tile entries', () => {
      const state: GridState = {
        t: [
          [1, 2], // Valid
          [0, 3], // Invalid: hexId must be > 0
          [64, 4], // Invalid: hexId must be <= 63
          [5, -1], // Invalid: state must be >= 0
          [6, 8], // Invalid: state must be <= 7
          [undefined as unknown as number, 2], // Invalid: undefined hexId
          [7, undefined as unknown as number], // Invalid: undefined state
          [63, 7], // Valid: max values
        ],
      }

      const validated = validateGridState(state)

      expect(validated.t).toEqual([
        [1, 2],
        [63, 7],
      ])
    })

    it('filters invalid character entries', () => {
      const state: GridState = {
        c: [
          [1, 100, 1], // Valid
          [0, 200, 2], // Invalid: hexId must be > 0
          [64, 300, 1], // Invalid: hexId must be <= 63
          [2, 0, 2], // Invalid: charId must be > 0
          [3, 20000, 1], // Invalid: charId must be <= 16383
          [4, 400, 0], // Invalid: team must be 1 or 2
          [5, 500, 3], // Invalid: team must be 1 or 2
          [undefined as unknown as number, 600, 1], // Invalid: undefined hexId
          [6, undefined as unknown as number, 2], // Invalid: undefined charId
          [7, 700, undefined as unknown as number], // Invalid: undefined team
          [63, 16383, 2], // Valid: max values
        ],
      }

      const validated = validateGridState(state)

      expect(validated.c).toEqual([
        [1, 100, 1],
        [63, 16383, 2],
      ])
    })

    it('preserves artifacts and display flags', () => {
      const state: GridState = {
        t: [[1, 1]],
        c: [[2, 100, 1]],
        a: [3, 5],
        d: 0b1010,
      }

      const validated = validateGridState(state)

      expect(validated).toEqual(state)
    })

    it('returns empty state for all invalid entries', () => {
      const state: GridState = {
        t: [
          [0, 0],
          [64, 8],
        ], // All invalid
        c: [[0, 0, 0]], // All invalid
      }

      const validated = validateGridState(state)

      expect(validated).toEqual({})
    })

    it('handles undefined arrays', () => {
      const state: GridState = {}

      const validated = validateGridState(state)

      expect(validated).toEqual({})
    })
  })
})
