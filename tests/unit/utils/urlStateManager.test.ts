import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { serializeGridState, type GridState } from '@/utils/gridStateSerializer'
import {
  decodeGridStateFromUrl,
  encodeGridStateToUrl,
  getEncodedStateFromRoute,
  getEncodedStateFromUrl,
} from '@/utils/urlStateManager'

// Helper function to create mock grid tiles
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
      expect(consoleSpy).toHaveBeenCalledWith('Failed to decode binary data from URL')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid character in URL-safe string:', '@')
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

  describe('serialize + encode round-trip', () => {
    it('encodes serialized tiles and artifacts', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
      ]
      const encoded = encodeGridStateToUrl(serializeGridState(tiles, 1, 2))

      const decoded = decodeGridStateFromUrl(encoded)
      expect(decoded?.c).toHaveLength(2)
      expect(decoded?.a).toEqual([1, 2])
    })

    it.each([
      [
        { showGridInfo: true, showArrows: false, showPerspective: true, showSkills: false },
        0b00101,
      ],
      [
        {
          showGridInfo: false,
          showArrows: false,
          showPerspective: false,
          showSkills: false,
          teamView: true,
        },
        0b10000,
      ],
    ])('round-trips display flags (%o)', (displayFlags, expected) => {
      const encoded = encodeGridStateToUrl(serializeGridState([], null, null, displayFlags))
      const decoded = decodeGridStateFromUrl(encoded)
      expect(decoded?.d).toBe(expected)
    })
  })

  describe('getEncodedStateFromUrl', () => {
    beforeEach(() => {
      vi.stubGlobal('window', { location: { search: '' } })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it.each([
      ['', null],
      ['?other=value&another=test', null],
      ['?g=encodedStateHere', 'encodedStateHere'],
      ['?l=zh&g=encodedState123&debug=true', 'encodedState123'],
      ['?g=state%20with%20spaces', 'state with spaces'],
    ])('with search "%s" returns %s', (search, expected) => {
      vi.stubGlobal('window', { location: { search } })
      const result = getEncodedStateFromUrl()
      expect(result).toBe(expected)
    })
  })

  describe('getEncodedStateFromRoute', () => {
    it.each([
      [{ g: 'encodedState123' }, 'encodedState123'],
      [{ g: ['state1', 'state2'] }, null],
      [{ g: null }, null],
      [{ g: undefined }, null],
      [{}, null],
      [{ l: 'zh', g: 'encodedState', debug: 'true' }, 'encodedState'],
      [{ g: '' }, ''],
    ])('with query %o returns %s', (query, expected) => {
      const result = getEncodedStateFromRoute(query)
      expect(result).toBe(expected)
    })
  })

  describe('Integration tests', () => {
    it('complete round-trip: tiles -> URL -> tiles', () => {
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
