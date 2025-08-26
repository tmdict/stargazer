import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GridTile } from '../../src/lib/grid'
import { Hex } from '../../src/lib/hex'
import { State } from '../../src/lib/types/state'
import { Team } from '../../src/lib/types/team'
import type { GridState } from '../../src/utils/gridStateSerializer'
import {
  decodeGridStateFromUrl,
  encodeGridStateToUrl,
  generateShareableUrl,
  getEncodedStateFromRoute,
  getEncodedStateFromUrl,
} from '../../src/utils/urlStateManager'

// Helper function to create mock grid tiles
function createMockTile(
  hexId: number,
  state: State = State.DEFAULT,
  characterId?: number,
  team?: Team,
): GridTile {
  return {
    hex: {
      getId: () => hexId,
    } as Hex,
    state,
    characterId,
    team,
  }
}

describe('urlStateManager', () => {
  describe('encodeGridStateToUrl and decodeGridStateFromUrl', () => {
    it('encodes and decodes empty state', () => {
      const state: GridState = {}
      const encoded = encodeGridStateToUrl(state)
      const decoded = decodeGridStateFromUrl(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes state with tiles', () => {
      const state: GridState = {
        t: [
          [1, 2],
          [5, 3],
        ],
      }
      const encoded = encodeGridStateToUrl(state)
      const decoded = decodeGridStateFromUrl(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes state with characters', () => {
      const state: GridState = {
        c: [
          [1, 100, Team.ALLY],
          [2, 200, Team.ENEMY],
        ],
      }
      const encoded = encodeGridStateToUrl(state)
      const decoded = decodeGridStateFromUrl(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes state with artifacts', () => {
      const state: GridState = {
        a: [3, 5],
      }
      const encoded = encodeGridStateToUrl(state)
      const decoded = decodeGridStateFromUrl(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes state with display flags', () => {
      const state: GridState = {
        t: [[1, 1]],
        d: 0b1010,
      }
      const encoded = encodeGridStateToUrl(state)
      const decoded = decodeGridStateFromUrl(encoded)

      expect(decoded).toEqual(state)
    })

    it('encodes and decodes complete state', () => {
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

    it('produces URL-safe encoded strings', () => {
      const state: GridState = {
        t: Array.from({ length: 10 }, (_, i) => [i + 1, (i % 7) + 1]),
        c: Array.from({ length: 5 }, (_, i) => [i + 10, 100 + i, (i % 2) + 1]),
      }
      const encoded = encodeGridStateToUrl(state)

      // Check that encoded string is URL-safe
      const urlSafePattern = /^[A-Za-z0-9\-_]+$/
      expect(encoded).toMatch(urlSafePattern)
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

      // Only valid entries are encoded
      expect(decoded).toEqual({
        t: [[1, 2]],
        c: [[1, 100, 1]],
      })
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles decoding errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const invalidEncoded = 'invalid@#$%data' // Contains invalid characters
      const decoded = decodeGridStateFromUrl(invalidEncoded)

      expect(decoded).toBeNull()
      // The actual error message is different
      expect(consoleSpy).toHaveBeenCalledWith('Failed to decode binary data from URL')

      consoleSpy.mockRestore()
    })

    it('returns empty state for empty encoded string', () => {
      const decoded = decodeGridStateFromUrl('')

      // Fixed: empty string now returns empty state
      expect(decoded).toEqual({})
    })
  })

  describe('generateShareableUrl', () => {
    beforeEach(() => {
      // Mock window.location
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
      expect(url).toContain('?g=')
    })

    it('generates URL with grid state', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
      ]
      const url = generateShareableUrl(tiles, 1, 2)

      expect(url).toMatch(/^http:\/\/localhost:3000\/app\?g=/)
      // Decode and verify the state
      const match = url.match(/\?g=(.+)$/)
      expect(match).toBeTruthy()
      const encoded = match![1]
      const decoded = decodeGridStateFromUrl(encoded)
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

      expect(url).toMatch(/^http:\/\/localhost:3000\/app\?g=/)
      // Decode and verify display flags
      const match = url.match(/\?g=(.+)$/)
      const encoded = match![1]
      const decoded = decodeGridStateFromUrl(encoded)
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
      // Default mock with no query params
      vi.stubGlobal('window', {
        location: {
          search: '',
        },
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('returns null when no query params', () => {
      const result = getEncodedStateFromUrl()
      expect(result).toBeNull()
    })

    it('returns null when g param is missing', () => {
      vi.stubGlobal('window', {
        location: {
          search: '?other=value&another=test',
        },
      })

      const result = getEncodedStateFromUrl()
      expect(result).toBeNull()
    })

    it('extracts g param from URL', () => {
      vi.stubGlobal('window', {
        location: {
          search: '?g=encodedStateHere',
        },
      })

      const result = getEncodedStateFromUrl()
      expect(result).toBe('encodedStateHere')
    })

    it('extracts g param with other params present', () => {
      vi.stubGlobal('window', {
        location: {
          search: '?l=zh&g=encodedState123&debug=true',
        },
      })

      const result = getEncodedStateFromUrl()
      expect(result).toBe('encodedState123')
    })

    it('handles URL-encoded characters in g param', () => {
      vi.stubGlobal('window', {
        location: {
          search: '?g=state%20with%20spaces',
        },
      })

      const result = getEncodedStateFromUrl()
      expect(result).toBe('state with spaces')
    })
  })

  describe('getEncodedStateFromRoute', () => {
    it('returns string value from query', () => {
      const query = { g: 'encodedState123' }
      const result = getEncodedStateFromRoute(query)
      expect(result).toBe('encodedState123')
    })

    it('returns null for array value', () => {
      const query = { g: ['state1', 'state2'] }
      const result = getEncodedStateFromRoute(query)
      expect(result).toBeNull()
    })

    it('returns null for null value', () => {
      const query = { g: null }
      const result = getEncodedStateFromRoute(query)
      expect(result).toBeNull()
    })

    it('returns null for undefined value', () => {
      const query = { g: undefined }
      const result = getEncodedStateFromRoute(query)
      expect(result).toBeNull()
    })

    it('returns null when g property is missing', () => {
      const query = {}
      const result = getEncodedStateFromRoute(query)
      expect(result).toBeNull()
    })

    it('handles query with other parameters', () => {
      const query = { l: 'zh', g: 'encodedState', debug: 'true' }
      const result = getEncodedStateFromRoute(query)
      expect(result).toBe('encodedState')
    })

    it('returns null for single-element array', () => {
      const query = { g: ['singleState'] }
      const result = getEncodedStateFromRoute(query)
      expect(result).toBeNull()
    })

    it('handles empty string value', () => {
      const query = { g: '' }
      const result = getEncodedStateFromRoute(query)
      expect(result).toBe('')
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

      // Generate URL
      const url = generateShareableUrl(originalTiles, 3, 5, displayFlags)

      // Extract encoded state from URL
      const match = url.match(/\?g=(.+)$/)
      expect(match).toBeTruthy()
      const encoded = match![1]

      // Decode state
      const decoded = decodeGridStateFromUrl(encoded)
      expect(decoded).not.toBeNull()
      // We have 3 non-default tiles (tiles 1, 3, and 4)
      expect(decoded?.t).toHaveLength(3)
      expect(decoded?.c).toHaveLength(2) // Two characters
      expect(decoded?.a).toEqual([3, 5])
      expect(decoded?.d).toBe(0b1011) // Display flags preserved
    })

    it('handles large grid states', () => {
      // Note: hex IDs must be 1-63, so we'll cycle through valid IDs
      const tiles: GridTile[] = Array.from({ length: 100 }, (_, i) =>
        createMockTile(
          (i % 63) + 1, // Cycle through hex IDs 1-63
          i % 3 === 0 ? State.DEFAULT : State.OCCUPIED_ALLY,
          i % 2 === 0 ? 1000 + i : undefined,
          i % 2 === 0 ? Team.ALLY : undefined,
        ),
      )

      const url = generateShareableUrl(tiles, 1, 2)
      const match = url.match(/\?g=(.+)$/)
      expect(match).toBeTruthy()
      const encoded = match![1]
      const decoded = decodeGridStateFromUrl(encoded)

      expect(decoded).not.toBeNull()
      // Fixed: display flags are not set when not provided
      expect(decoded?.d).toBeUndefined()
      expect(decoded?.t?.length).toBeGreaterThan(0)
      expect(decoded?.c?.length).toBeGreaterThan(0)
    })
  })
})
