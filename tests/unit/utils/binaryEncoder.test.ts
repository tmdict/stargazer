import { describe, expect, it, vi } from 'vitest'

import {
  bytesToUrlSafe,
  decodeFromBinary,
  encodeToBinary,
  urlSafeToBytes,
  validateGridState,
} from '@/utils/binaryEncoder'
import type { GridState } from '@/utils/gridStateSerializer'

describe('binaryEncoder', () => {
  describe('encodeToBinary and decodeFromBinary', () => {
    it.each([
      ['empty state', {}],
      [
        'only tiles',
        {
          t: [
            [1, 2],
            [5, 3],
            [10, 1],
          ],
        },
      ],
      [
        'only characters',
        {
          c: [
            [1, 100, 1],
            [5, 200, 2],
            [10, 10001, 1],
          ],
        },
      ],
      ['only artifacts', { a: [3, 5] }],
      ['artifact IDs above 7', { a: [9, 18] }],
      ['null artifacts', { a: [null, 5] }],
      ['both null artifacts', { a: [null, null] }],
      [
        'companion IDs',
        {
          c: [
            [10, 89, 1],
            [11, 10089, 1],
            [12, 20089, 1], // Zanie's second turret: 2 * companionIdOffset + 89
          ],
        },
      ],
      ['display flags with inverted (bit 5)', { t: [[1, 1]], d: 0b101010 }],
      ['display flags zero', { t: [[1, 1]], d: 0 }],
      [
        'display flags zero with extended counts',
        { t: Array.from({ length: 10 }, (_, i) => [i + 1, 1]), d: 0 },
      ],
      ['display flags zero with phantimals', { p: [[5, 1, 1]], d: 0 }],
      [
        'complete state',
        {
          t: [
            [1, 2],
            [5, 3],
          ],
          c: [
            [2, 100, 1],
            [6, 200, 2],
          ],
          a: [2, 4],
        },
      ],
      [
        'only phantimals',
        {
          p: [
            [1, 3, 1],
            [5, 2, 2],
          ],
        },
      ],
      [
        'phantimals with characters and artifacts',
        {
          c: [[2, 100, 1]],
          a: [2, 4],
          p: [[7, 1, 2]],
        },
      ],
      [
        'phantimals with display flags',
        {
          t: [[1, 1]],
          p: [[3, 4, 1]],
          d: 0b1010,
        },
      ],
      [
        'paragon levels with characters',
        {
          c: [
            [2, 100, 1],
            [6, 200, 2],
          ],
          pr: [
            [1, 100, 4],
            [2, 200, 2],
          ],
        },
      ],
      ['only paragon', { pr: [[1, 33, 3]] }],
      [
        'paragon with phantimals and display flags',
        {
          c: [[2, 100, 1]],
          p: [[7, 1, 2]],
          pr: [[1, 100, 4]],
          d: 0b1,
        },
      ],
    ])('encodes and decodes %s', (_, state) => {
      const encoded = encodeToBinary(state as GridState)
      const decoded = decodeFromBinary(encoded)
      expect(decoded).toEqual(state)
    })

    describe('extended header handling', () => {
      it.each([
        ['8+ tiles', { t: Array.from({ length: 10 }, (_, i) => [i + 1, 1]) }],
        [
          '8+ characters',
          { c: Array.from({ length: 12 }, (_, i) => [i + 1, 100 + i, (i % 2) + 1]) },
        ],
      ])('handles %s', (_, state) => {
        const encoded = encodeToBinary(state as GridState)
        const decoded = decodeFromBinary(encoded)
        expect(decoded).toEqual(state)
      })

      it('handles maximum tiles (262) with content intact', () => {
        const maxTiles = 262 // 7 in header + 255 in extended
        const state: GridState = {
          t: Array.from({ length: maxTiles }, (_, i) => [(i % 63) + 1, (i % 7) + 1]),
        }
        const encoded = encodeToBinary(state)
        const decoded = decodeFromBinary(encoded)
        expect(decoded?.t).toEqual(state.t)
      })

      it('handles maximum characters (262) with content intact', () => {
        const maxChars = 262 // 7 in header + 255 in extended
        const state: GridState = {
          c: Array.from({ length: maxChars }, (_, i) => [
            (i % 63) + 1,
            (i % 1000) + 1,
            (i % 2) + 1,
          ]),
        }
        const encoded = encodeToBinary(state)
        const decoded = decodeFromBinary(encoded)
        expect(decoded?.c).toEqual(state.c)
      })

      it('round-trips the maximum phantimal count (15)', () => {
        const state: GridState = {
          p: Array.from({ length: 15 }, (_, i) => [i + 1, (i % 15) + 1, (i % 2) + 1]),
        }
        const encoded = encodeToBinary(state)
        const decoded = decodeFromBinary(encoded)
        expect(decoded?.p).toEqual(state.p)
      })
    })

    describe('wire format', () => {
      // Shared URLs embed this exact format: a change to bit layout, header
      // flags, or the URL-safe alphabet silently breaks every existing link.
      // If this test fails, the encoding changed — old URLs no longer decode
      const GOLDEN_STATE: GridState = {
        t: [
          [1, 2],
          [5, 3],
        ],
        c: [
          [2, 100, 1],
          [6, 200, 2],
          [10, 10089, 1],
        ],
        a: [3, 18],
        p: [[7, 2, 2]],
        d: 0b10110,
      }
      const GOLDEN_ENCODED = '2sAWgYoJZAAMZIBK2olBikMC'

      it('encodes the golden state to the frozen string', () => {
        expect(bytesToUrlSafe(encodeToBinary(GOLDEN_STATE))).toBe(GOLDEN_ENCODED)
      })

      it('decodes the frozen string back to the golden state', () => {
        const bytes = urlSafeToBytes(GOLDEN_ENCODED)
        expect(bytes).not.toBeNull()
        expect(decodeFromBinary(bytes!)).toEqual(GOLDEN_STATE)
      })
    })

    describe('validation and filtering', () => {
      it('handles max character ID (65535)', () => {
        const state: GridState = {
          c: [
            [1, 65535, 1],
            [2, 1, 2],
            [3, 10000, 1],
          ],
        }
        const encoded = encodeToBinary(state)
        const decoded = decodeFromBinary(encoded)
        expect(decoded).toEqual(state)
      })

      it('filters invalid entries with warnings', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const state: GridState = {
          t: [
            [1, 2],
            [undefined as unknown as number, 3], // Invalid
            [64, 3], // Invalid: hexId > 63
          ],
          c: [
            [1, 100, 1],
            [2, 70000, 1], // Invalid: charId > 65535
            [3, 300, 3], // Invalid: team must be 1 or 2
          ],
        }

        const encoded = encodeToBinary(state)
        const decoded = decodeFromBinary(encoded)

        // Only valid entries are preserved
        expect(decoded?.t).toEqual([[1, 2]])
        expect(decoded?.c).toEqual([[1, 100, 1]])
        expect(consoleSpy).toHaveBeenCalled()

        consoleSpy.mockRestore()
      })
    })

    describe('error handling', () => {
      it('handles empty array', () => {
        const result = decodeFromBinary(new Uint8Array())
        expect(result).toEqual({})
      })

      it.each([
        ['invalid header', new Uint8Array([0xff, 0xff])],
        ['truncated data', new Uint8Array([0x10])], // Header says there's data but none provided
      ])('handles %s gracefully', (_, invalidData) => {
        // decodeFromBinary logs to console.error on failure; suppress for these expected-failure cases.
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const result = decodeFromBinary(invalidData)
        expect(result).toBeNull()
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
      })
    })
  })

  describe('validateGridState', () => {
    it('validates correct state', () => {
      const state: GridState = {
        t: [
          [1, 2],
          [5, 3],
        ],
        c: [[2, 100, 1]],
        a: [2, 4],
      }
      const result = validateGridState(state)
      expect(result).toEqual(state)
    })

    it('handles invalid entries', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const state: GridState = {
        t: [
          [0, 2],
          [64, 3],
          [1, 2],
        ], // Invalid: 0 and 64
        c: [
          [1, 70000, 1],
          [2, 100, 1],
        ], // Invalid: charId > 65535
      }
      const result = validateGridState(state)
      expect(result).toEqual({
        t: [[1, 2]],
        c: [[2, 100, 1]],
      })
      consoleSpy.mockRestore()
    })

    it('nulls out-of-range artifact IDs instead of truncating them', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = validateGridState({ a: [64, 18] })
      expect(result).toEqual({ a: [null, 18] })
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('caps phantimal entries at the 4-bit count limit (15)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const state: GridState = {
        p: Array.from({ length: 16 }, (_, i) => [i + 1, (i % 15) + 1, (i % 2) + 1]),
      }
      const result = validateGridState(state)
      expect(result.p).toHaveLength(15)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('handles null and undefined input', () => {
      expect(validateGridState(null as unknown as GridState)).toEqual({})
      expect(validateGridState(undefined as unknown as GridState)).toEqual({})
    })

    it('handles non-object inputs', () => {
      expect(validateGridState('invalid' as unknown as GridState)).toEqual({})
      expect(validateGridState(123 as unknown as GridState)).toEqual({})
      expect(validateGridState([] as unknown as GridState)).toEqual({})
    })

    it('handles invalid structure types', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Invalid tile structure
      expect(validateGridState({ t: 'invalid' } as unknown as GridState)).toEqual({})
      expect(validateGridState({ t: null } as unknown as GridState)).toEqual({})

      // Invalid character structure
      expect(validateGridState({ c: 'invalid' } as unknown as GridState)).toEqual({})
      expect(validateGridState({ c: [[1, 2]] } as unknown as GridState)).toEqual({}) // Missing team

      // Invalid artifact structure
      expect(validateGridState({ a: [1] } as unknown as GridState)).toEqual({}) // Not exactly 2 elements
      expect(validateGridState({ a: [1, 2, 3] } as unknown as GridState)).toEqual({}) // Too many elements
      expect(validateGridState({ a: 'invalid' } as unknown as GridState)).toEqual({})

      consoleSpy.mockRestore()
    })
  })

  describe('URL-safe encoding', () => {
    const testCases = [
      new Uint8Array([0, 1, 2, 3]),
      new Uint8Array([255, 254, 253]),
      new Uint8Array(Array.from({ length: 100 }, (_, i) => i)),
    ]

    it.each(testCases)('converts bytes to URL-safe and back', (bytes) => {
      const urlSafe = bytesToUrlSafe(bytes)
      expect(urlSafe).toMatch(/^[A-Za-z0-9_-]*$/) // URL-safe characters only

      const decoded = urlSafeToBytes(urlSafe)
      expect(decoded).toEqual(bytes)
    })

    it('handles empty input', () => {
      expect(bytesToUrlSafe(new Uint8Array())).toBe('')
      expect(urlSafeToBytes('')).toEqual(new Uint8Array())
    })

    it('handles padding correctly', () => {
      // Test various lengths that require different padding
      const bytes1 = new Uint8Array([1])
      const bytes2 = new Uint8Array([1, 2])
      const bytes3 = new Uint8Array([1, 2, 3])

      const url1 = bytesToUrlSafe(bytes1)
      const url2 = bytesToUrlSafe(bytes2)
      const url3 = bytesToUrlSafe(bytes3)

      expect(urlSafeToBytes(url1)).toEqual(bytes1)
      expect(urlSafeToBytes(url2)).toEqual(bytes2)
      expect(urlSafeToBytes(url3)).toEqual(bytes3)
    })

    it('returns null for strings outside the URL-safe alphabet', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(urlSafeToBytes('abc!def')).toBeNull()
      expect(urlSafeToBytes('with space')).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Invalid character in URL-safe string:', '!')
      expect(consoleSpy).toHaveBeenCalledWith('Invalid character in URL-safe string:', ' ')
      consoleSpy.mockRestore()
    })
  })
})
