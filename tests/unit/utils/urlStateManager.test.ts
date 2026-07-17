import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import {
  serializeGridState,
  type GridState,
  type MultiGridState,
} from '@/utils/gridStateSerializer'
import {
  decodeGridStateFromUrl,
  decodeMultiGridStateFromUrl,
  encodeGridStateToUrl,
  encodeMultiGridStateToUrl,
  getEncodedStateFromRoute,
  getEncodedStateFromUrl,
} from '@/utils/urlStateManager'

function createMockTile(
  hexId: number,
  state: State = State.DEFAULT,
  characterId?: number,
  team?: Team,
): GridTile {
  return {
    hex: { getId: () => hexId } as Hex,
    state,
    characterId,
    team,
  }
}

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
    beforeEach(() => {
      vi.stubGlobal('window', { location: { search: '' } })
    })

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

  describe('Integration tests', () => {
    it('complete round-trip: GridState -> URL -> GridState', () => {
      const originalTiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.DEFAULT),
        createMockTile(3, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
        createMockTile(4, State.BLOCKED),
      ]
      const displayFlags = {
        showGridInfo: true,
        showArrows: true,
        showPerspective: false,
        showSkills: true,
      }

      const encoded = encodeGridStateToUrl(serializeGridState(originalTiles, 3, 5, displayFlags))

      const decoded = decodeGridStateFromUrl(encoded)
      expect(decoded).not.toBeNull()
      expect(decoded?.t).toHaveLength(3)
      expect(decoded?.c).toHaveLength(2)
      expect(decoded?.a).toEqual([3, 5])
      expect(decoded?.d).toBe(0b1011)
    })

    it('handles large grid states', () => {
      const tiles: GridTile[] = Array.from({ length: 100 }, (_, i) =>
        createMockTile(
          (i % 63) + 1,
          i % 3 === 0 ? State.DEFAULT : State.OCCUPIED_ALLY,
          i % 2 === 0 ? 1000 + i : undefined,
          i % 2 === 0 ? Team.ALLY : undefined,
        ),
      )

      const encoded = encodeGridStateToUrl(serializeGridState(tiles, 1, 2))

      const decoded = decodeGridStateFromUrl(encoded)
      expect(decoded).not.toBeNull()
      expect(decoded?.d).toBeUndefined()
      // 66 non-default tiles and 50 characters force the extended header
      expect(decoded?.t).toHaveLength(66)
      expect(decoded?.c).toHaveLength(50)
    })
  })
})
