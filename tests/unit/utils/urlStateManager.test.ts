import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import type { GridState } from '@/utils/gridStateSerializer'
import {
  decodeGridStateFromUrl,
  encodeGridStateToUrl,
  generateShareableUrl,
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
    it.each([
      ['empty state', {}],
      [
        'state with tiles',
        {
          t: [
            [1, 2],
            [5, 3],
          ],
        },
      ],
      [
        'state with characters',
        {
          c: [
            [1, 100, Team.ALLY],
            [2, 200, Team.ENEMY],
          ],
        },
      ],
      ['state with artifacts', { a: [3, 5] }],
      ['state with display flags', { t: [[1, 1]], d: 0b1010 }],
      [
        'complete state',
        {
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
        },
      ],
    ])('encodes and decodes %s', (_, state) => {
      const encoded = encodeGridStateToUrl(state as GridState)
      const decoded = decodeGridStateFromUrl(encoded)
      expect(decoded).toEqual(state)
    })

    it('produces URL-safe encoded strings', () => {
      const state: GridState = {
        t: Array.from({ length: 10 }, (_, i) => [i + 1, (i % 7) + 1]),
        c: Array.from({ length: 5 }, (_, i) => [i + 10, 100 + i, (i % 2) + 1]),
      }
      const encoded = encodeGridStateToUrl(state)
      expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/)
    })

    it('validates and filters invalid entries', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const state: GridState = {
        t: [
          [1, 2], // Valid
          [0, 3], // Invalid: hexId must be > 0
          [64, 4], // Invalid: hexId > 63
        ],
        c: [
          [1, 100, 1], // Valid
          [2, 20000, 1], // Invalid: charId > 16383
        ],
      }
      const encoded = encodeGridStateToUrl(state)
      const decoded = decodeGridStateFromUrl(encoded)

      expect(decoded).toEqual({
        t: [[1, 2]],
        c: [[1, 100, 1]],
      })
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('handles decoding errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const invalidEncoded = 'invalid@#$%data'
      const decoded = decodeGridStateFromUrl(invalidEncoded)

      expect(decoded).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Failed to decode binary data from URL')
      consoleSpy.mockRestore()
    })

    it('returns empty state for empty encoded string', () => {
      const decoded = decodeGridStateFromUrl('')
      expect(decoded).toEqual({})
    })
  })

  describe('generateShareableUrl', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        location: {
          origin: 'http://localhost:3000',
          pathname: '/app',
        },
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('generates URL with empty grid', () => {
      const tiles: GridTile[] = []
      const url = generateShareableUrl(tiles, null, null)
      expect(url).toMatch(/^http:\/\/localhost:3000\/app\?g=/)
    })

    it('generates URL with grid state', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
      ]
      const url = generateShareableUrl(tiles, 1, 2)

      const match = url.match(/\?g=(.+)$/)
      expect(match).toBeTruthy()
      const decoded = decodeGridStateFromUrl(match![1])
      expect(decoded?.c).toHaveLength(2)
      expect(decoded?.a).toEqual([1, 2])
    })

    it('generates URL with display flags', () => {
      const tiles: GridTile[] = []
      const displayFlags = {
        showHexIds: true,
        showArrows: false,
        showPerspective: true,
        showSkills: false,
      }
      const url = generateShareableUrl(tiles, null, null, displayFlags)

      const match = url.match(/\?g=(.+)$/)
      const decoded = decodeGridStateFromUrl(match![1])
      expect(decoded?.d).toBe(0b0101)
    })

    it('uses correct base URL from window.location', () => {
      vi.stubGlobal('window', {
        location: {
          origin: 'https://example.com',
          pathname: '/game/board',
        },
      })

      const tiles: GridTile[] = []
      const url = generateShareableUrl(tiles, null, null)
      expect(url).toMatch(/^https:\/\/example\.com\/game\/board\?g=/)
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
      [{ g: ['singleState'] }, null],
      [{ g: '' }, ''],
    ])('with query %o returns %s', (query, expected) => {
      const result = getEncodedStateFromRoute(query)
      expect(result).toBe(expected)
    })
  })

  describe('Integration tests', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        location: {
          origin: 'http://localhost:3000',
          pathname: '/',
        },
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('complete round-trip: tiles -> URL -> tiles', () => {
      const originalTiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.DEFAULT),
        createMockTile(3, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
        createMockTile(4, State.BLOCKED),
      ]
      const displayFlags = {
        showHexIds: true,
        showArrows: true,
        showPerspective: false,
        showSkills: true,
      }

      const url = generateShareableUrl(originalTiles, 3, 5, displayFlags)
      const match = url.match(/\?g=(.+)$/)
      expect(match).toBeTruthy()

      const decoded = decodeGridStateFromUrl(match![1])
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

      const url = generateShareableUrl(tiles, 1, 2)
      const match = url.match(/\?g=(.+)$/)
      expect(match).toBeTruthy()

      const decoded = decodeGridStateFromUrl(match![1])
      expect(decoded).not.toBeNull()
      expect(decoded?.d).toBeUndefined()
      expect(decoded?.t?.length).toBeGreaterThan(0)
      expect(decoded?.c?.length).toBeGreaterThan(0)
    })
  })
})
