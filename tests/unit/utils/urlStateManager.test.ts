import { afterEach, describe, expect, it, vi } from 'vitest'

import { Team } from '@/lib/types/team'
import type { GridState, MultiGridState } from '@/utils/gridStateSerializer'
import {
  decodeGridStateFromUrl,
  decodeMultiGridStateFromUrl,
  encodeGridStateToUrl,
  encodeMultiGridStateToUrl,
  getEncodedStateFromRoute,
  getEncodedStateFromUrl,
} from '@/utils/urlStateManager'

describe('urlStateManager', () => {
  describe('encodeGridStateToUrl and decodeGridStateFromUrl', () => {
    // Round-trip content is pinned by the binaryEncoder tests; this verifies
    // the composition seam once
    it('encodes and decodes a complete state', () => {
      const state: GridState = {
        t: [
          [1, 2],
          [5, 3],
        ],
        c: [
          [2, 100, Team.ALLY],
          [6, 200, Team.ENEMY],
        ],
        a: [2, 4],
        d: 0b1111,
      }
      const encoded = encodeGridStateToUrl(state)
      const decoded = decodeGridStateFromUrl(encoded)
      expect(decoded).toEqual(state)
    })

    it('handles decoding errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const invalidEncoded = 'invalid@#$%data'
      const decoded = decodeGridStateFromUrl(invalidEncoded)

      expect(decoded).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('rejects input that decodes to zero bytes', () => {
      // A valid encoding always carries at least one header byte, so inputs
      // too short to yield a single byte cannot be real shared state
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(decodeGridStateFromUrl('')).toBeNull()
      expect(decodeGridStateFromUrl('A')).toBeNull()

      consoleSpy.mockRestore()
    })
  })

  describe('encodeMultiGridStateToUrl and decodeMultiGridStateFromUrl', () => {
    const encodeRaw = (value: unknown): string => encodeMultiGridStateToUrl(value as MultiGridState)

    it('round-trips a multi-board state', () => {
      const state: MultiGridState = {
        boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena2' }],
        active: 1,
        d: 3,
        mode: '3v3',
      }
      expect(decodeMultiGridStateFromUrl(encodeMultiGridStateToUrl(state))).toEqual(state)
    })

    it('rejects undecodable input and payloads whose boards are not an array', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(decodeMultiGridStateFromUrl('!!!invalid!!!')).toBeNull()
      expect(decodeMultiGridStateFromUrl(encodeRaw({}))).toBeNull()
      expect(decodeMultiGridStateFromUrl(encodeRaw({ boards: 'x' }))).toBeNull()
      expect(decodeMultiGridStateFromUrl(encodeRaw(null))).toBeNull()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('rejects crafted payloads with non-object board entries', () => {
      // Consumers past this boundary (canonicalization, validation, restore)
      // read board keys directly, so these must never decode.
      expect(decodeMultiGridStateFromUrl(encodeRaw({ boards: [null] }))).toBeNull()
      expect(decodeMultiGridStateFromUrl(encodeRaw({ boards: [[1, 2]] }))).toBeNull()
      expect(decodeMultiGridStateFromUrl(encodeRaw({ boards: [{}, 'x'] }))).toBeNull()
    })
  })

  describe('getEncodedStateFromUrl', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('reads the state from the g query param', () => {
      vi.stubGlobal('window', { location: { search: '?l=zh&g=encodedState123&debug=true' } })
      expect(getEncodedStateFromUrl()).toBe('encodedState123')
    })
  })

  describe('getEncodedStateFromRoute', () => {
    it.each([
      [{ g: 'encodedState123' }, 'encodedState123'],
      [{ g: ['state1', 'state2'] }, null],
    ])('with query %o returns %s', (query, expected) => {
      const result = getEncodedStateFromRoute(query)
      expect(result).toBe(expected)
    })
  })
})
