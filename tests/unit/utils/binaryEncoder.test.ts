import { describe, expect, it, vi } from 'vitest'

import {
  bytesToUrlSafe,
  decodeLink,
  encodeLink,
  urlSafeToBytes,
  validateGridState,
} from '@/utils/binaryEncoder'
import {
  packDisplayFlags,
  unpackDisplayFlags,
  type BoardState,
  type GridState,
} from '@/utils/gridStateSerializer'

// The envelope's mandatory flags byte for a state that carried none.
const DEFAULT_FLAGS = packDisplayFlags(unpackDisplayFlags(undefined))

const arenaLink = (board: BoardState, d?: number): Uint8Array =>
  encodeLink({ mode: 'arena', boards: [board], d })

describe('binaryEncoder', () => {
  describe('encodeLink and decodeLink', () => {
    it.each([
      ['empty board', {}],
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
      [
        'only phantimals',
        {
          s: [
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
          s: [[7, 1, 2]],
        },
      ],
      [
        'synergy units',
        {
          y: [
            [3, 50, 1],
            [4, 10050, 2],
          ],
        },
      ],
      [
        'upgrade rows with characters',
        {
          c: [
            [2, 100, 1],
            [6, 200, 2],
          ],
          u: [
            [1, 100, 1, 4],
            [1, 100, 2, 3],
            [2, 200, 1, 2],
          ],
        },
      ],
      ['only upgrades', { u: [[1, 33, 1, 3]] }],
      ['a team-scope sentinel row (characterId 0)', { u: [[1, 0, 2, 4]] }],
      [
        'every section together',
        {
          t: [[1, 2]],
          c: [[2, 100, 1]],
          a: [2, 4],
          s: [[7, 1, 2]],
          y: [[5, 100, 1]],
          u: [[1, 100, 1, 4]],
        },
      ],
    ])('round-trips an arena board with %s', (_, board) => {
      const decoded = decodeLink(arenaLink(board as BoardState))
      expect(decoded).toEqual({ mode: 'arena', active: 0, d: DEFAULT_FLAGS, boards: [board] })
    })

    it('round-trips a full 45-tile board', () => {
      const board: BoardState = {
        t: Array.from({ length: 45 }, (_, i) => [i + 1, (i % 7) + 1]),
        c: Array.from({ length: 10 }, (_, i) => [i + 1, 100 + i, (i % 2) + 1]),
      }
      expect(decodeLink(arenaLink(board))!.boards[0]).toEqual(board)
    })

    it('round-trips a multi-board link with maps, active board, and flags', () => {
      const boards: BoardState[] = [
        { m: 'arena1', c: [[1, 11, 1]], u: [[1, 11, 2, 3]] },
        { m: 'arena2', t: [[4, 5]] },
        { m: 'preset-sr3' },
      ]
      const decoded = decodeLink(encodeLink({ mode: '3v3', boards, active: 2, d: 0b10110 }))
      expect(decoded).toEqual({ mode: '3v3', active: 2, d: 0b10110, boards })
    })

    it('preserves an explicit all-off flags byte and defaults an absent one', () => {
      expect(decodeLink(arenaLink({}, 0))!.d).toBe(0)
      expect(decodeLink(arenaLink({}))!.d).toBe(DEFAULT_FLAGS)
    })

    it('clamps the active board into the mode range on both sides', () => {
      const boards: BoardState[] = [{ m: 'arena1' }, { m: 'arena1' }, { m: 'arena1' }]
      expect(decodeLink(encodeLink({ mode: '3v3', boards, active: 9 }))!.active).toBe(2)
    })

    it('pads or trims a board list that disagrees with the mode', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const decoded = decodeLink(encodeLink({ mode: '3v3', boards: [{ m: 'arena1' }] }))
      expect(decoded!.boards).toEqual([{ m: 'arena1' }, {}, {}])
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('encodes an unregistered map key as none, keeping the board content', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const decoded = decodeLink(
        encodeLink({ mode: '1v1', boards: [{ m: 'retired-map', t: [[1, 1]] }] }),
      )
      expect(decoded!.boards[0]).toEqual({ t: [[1, 1]] })
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('throws on an unknown mode key', () => {
      expect(() => encodeLink({ mode: '9v9', boards: [] })).toThrow()
    })
  })

  describe('strict decoding', () => {
    // Hand-assembled v2 bit streams (LSB-first, like BitWriter).
    const v2Bytes = (build: (push: (value: number, count: number) => void) => void): Uint8Array => {
      const bits: number[] = []
      const push = (value: number, count: number): void => {
        for (let i = 0; i < count; i++) bits.push((value >> i) & 1)
      }
      build(push)
      const bytes: number[] = []
      for (let i = 0; i < bits.length; i += 8) {
        let byte = 0
        for (let j = 0; j < 8 && i + j < bits.length; j++) byte |= bits[i + j]! << j
        bytes.push(byte)
      }
      return new Uint8Array(bytes)
    }

    it('rejects an unknown mode id', () => {
      const bytes = v2Bytes((push) => {
        push(7, 3) // unregistered mode
        push(0, 3)
        push(0, 8)
        push(0, 6)
        push(0, 8)
      })
      expect(decodeLink(bytes)).toBeNull()
    })

    it('rejects an unknown map id', () => {
      const bytes = v2Bytes((push) => {
        push(0, 3) // arena
        push(0, 3)
        push(0, 8)
        push(63, 6) // unregistered map
        push(0, 8)
      })
      expect(decodeLink(bytes)).toBeNull()
    })

    it('rejects unknown section-bitmap bits', () => {
      const bytes = v2Bytes((push) => {
        push(0, 3)
        push(0, 3)
        push(0, 8)
        push(0, 6)
        push(0x40, 8) // spare bit 6 set
      })
      expect(decodeLink(bytes)).toBeNull()
    })

    // The encoder never writes an empty section (validation drops them), and
    // arena boards never carry a map — both patterns are how short legacy
    // payloads were observed to misread as plausible v2 links.
    it('rejects a zero-count section', () => {
      const bytes = v2Bytes((push) => {
        push(0, 3) // arena
        push(0, 3)
        push(0, 8)
        push(0, 6)
        push(0x20, 8) // upgrades section present
        push(0, 6) // ...with zero rows
      })
      expect(decodeLink(bytes)).toBeNull()
    })

    it('rejects an arena board carrying a map id', () => {
      const bytes = v2Bytes((push) => {
        push(0, 3) // arena
        push(0, 3)
        push(0, 8)
        push(1, 6) // arena1 — legal for team modes, never for arena
        push(0, 8)
      })
      expect(decodeLink(bytes)).toBeNull()
    })

    it('strips a crafted map from an arena board on encode', () => {
      const decoded = decodeLink(arenaLink({ m: 'arena1', t: [[1, 1]] }))
      expect(decoded!.boards[0]).toEqual({ t: [[1, 1]] })
    })

    // The full-consumption rule: trailing content beyond the mode's boards
    // means the payload is not a v2 link, however plausible its prefix.
    it('rejects trailing bytes after a valid payload', () => {
      const valid = arenaLink({ t: [[1, 1]] })
      const padded = new Uint8Array([...valid, 0xff])
      expect(decodeLink(valid)).not.toBeNull()
      expect(decodeLink(padded)).toBeNull()
    })

    it('rejects truncated payloads and empty input', () => {
      const valid = arenaLink({ c: [[2, 100, 1]] })
      expect(decodeLink(valid.slice(0, valid.length - 1))).toBeNull()
      expect(decodeLink(new Uint8Array())).toBeNull()
      expect(decodeLink(new Uint8Array([0]))).toBeNull()
    })

    // Cross-format guardrails: the other formats' bytes must fail to null,
    // never misparse — the shim's probe order depends on it.
    it('rejects v1 payloads (the retired binary format)', () => {
      const V1_GOLDEN = '2sAWgYoJZAAMZIBK2olBikMC'
      const V1_GOLDEN_SECTIONS = 'iUyBBDIAcchIBgAIyAACigwgDA'
      expect(decodeLink(urlSafeToBytes(V1_GOLDEN)!)).toBeNull()
      expect(decodeLink(urlSafeToBytes(V1_GOLDEN_SECTIONS)!)).toBeNull()
    })

    it('rejects JSON multi payloads', () => {
      const json = new TextEncoder().encode(
        JSON.stringify({ boards: [{ m: 'arena1', c: [[1, 11, 1]] }], mode: '1v1' }),
      )
      expect(decodeLink(json)).toBeNull()
    })
  })

  describe('wire format', () => {
    /* Shared URLs embed this exact format: a change to bit layout, field
     * order, section order, or the URL-safe alphabet silently breaks every
     * existing link. If these fail, the encoding changed and old URLs no
     * longer decode. */
    const GOLDEN_ARENA_BOARD: BoardState = {
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
      s: [[7, 2, 2]],
      y: [[9, 3, 1]],
      u: [
        [1, 100, 1, 4],
        [2, 200, 2, 3],
      ],
    }
    const GOLDEN_ARENA_ENCODED = 'gAXwIwQqNghkAAxkgEraiUGKQ0YyAEBABhBQZABhAA'

    const GOLDEN_TEAMS_LINK = {
      mode: '3v3',
      active: 1,
      d: 0b10110,
      boards: [
        { m: 'arena1', c: [[1, 11, 1]], u: [[1, 11, 1, 4]] },
        { m: 'arena2', t: [[4, 5]] },
        { m: 'preset-sr1' },
      ] as BoardState[],
    }
    const GOLDEN_TEAMS_ENCODED = 'ikUgEgQLAAILAAEJAQHRBQA'

    it('encodes the golden arena link to the frozen string', () => {
      expect(bytesToUrlSafe(arenaLink(GOLDEN_ARENA_BOARD, 0b10110))).toBe(GOLDEN_ARENA_ENCODED)
    })

    it('decodes the frozen arena string back to the golden state', () => {
      const decoded = decodeLink(urlSafeToBytes(GOLDEN_ARENA_ENCODED)!)
      expect(decoded).toEqual({
        mode: 'arena',
        active: 0,
        d: 0b10110,
        boards: [GOLDEN_ARENA_BOARD],
      })
    })

    it('encodes the golden teams link to the frozen string', () => {
      expect(bytesToUrlSafe(encodeLink(GOLDEN_TEAMS_LINK))).toBe(GOLDEN_TEAMS_ENCODED)
    })

    it('decodes the frozen teams string back to the golden link', () => {
      expect(decodeLink(urlSafeToBytes(GOLDEN_TEAMS_ENCODED)!)).toEqual(GOLDEN_TEAMS_LINK)
    })
  })

  describe('validateGridState', () => {
    it('passes a valid state through and strips invalid entries', () => {
      const valid: GridState = {
        t: [
          [1, 2],
          [5, 3],
        ],
        c: [[2, 100, 1]],
        a: [2, 4],
      }
      expect(validateGridState(valid)).toEqual(valid)

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

    // Every count field caps at its width: an oversized crafted list would
    // otherwise wrap the encoded count and desync the decoder.
    it.each([
      ['tiles', { t: Array.from({ length: 64 }, (_, i) => [(i % 63) + 1, 1]) }, 't', 63],
      [
        'characters',
        { c: Array.from({ length: 64 }, (_, i) => [(i % 63) + 1, 100 + i, (i % 2) + 1]) },
        'c',
        63,
      ],
      [
        'phantimals',
        { s: Array.from({ length: 16 }, (_, i) => [i + 1, (i % 15) + 1, 1]) },
        's',
        15,
      ],
      ['synergy', { y: Array.from({ length: 16 }, (_, i) => [i + 1, 100 + i, 1]) }, 'y', 15],
      [
        'upgrades',
        { u: Array.from({ length: 64 }, (_, i) => [(i % 2) + 1, i + 1, 1, 3]) },
        'u',
        63,
      ],
    ])('caps %s at the count field maximum', (_, state, key, max) => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(validateGridState(state as GridState)[key as keyof GridState]).toHaveLength(
        max as number,
      )
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    // A value past the registry range must clamp before writeBits sees it: the
    // 4-bit field would otherwise truncate (17 → 1), corrupting the wire.
    it('normalizes upgrade rows: drops junk teams/attrIds, clamps values, dedupes last-wins', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const state: GridState = {
        u: [
          [3, 11, 1, 2], // team outside {1, 2}
          [1, 11, 99, 2], // unknown attrId
          [1, 11, 1, 17], // clamps to registry max
          [1, 12, 2, 3],
          [1, 12, 2, 0], // duplicate ending at default: row drops
        ],
      }
      expect(validateGridState(state).u).toEqual([[1, 11, 1, 4]])
      consoleSpy.mockRestore()
    })

    it('validates synergy entries before capping', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const good: number[][] = Array.from({ length: 20 }, (_, i) => [i + 1, 100 + i, 1])
      const bad: number[][] = [
        [0, 50, 1],
        [1, 0, 1],
        [1, 70000, 1],
        [1, 50, 3],
      ]
      const validated = validateGridState({ y: [...bad, ...good] })
      expect(validated.y).toHaveLength(15)
      expect(validated.y![0]).toEqual([1, 100, 1])
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('returns an empty state for non-object input', () => {
      expect(validateGridState(null as unknown as GridState)).toEqual({})
      expect(validateGridState(undefined as unknown as GridState)).toEqual({})
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
    // Lengths 1-3 cover every 6-bit padding remainder
    const testCases = [
      new Uint8Array([1]),
      new Uint8Array([1, 2]),
      new Uint8Array([1, 2, 3]),
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

    it('returns null for strings outside the URL-safe alphabet', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(urlSafeToBytes('abc!def')).toBeNull()
      expect(urlSafeToBytes('with space')).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
