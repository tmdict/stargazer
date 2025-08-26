import { describe, expect, it } from 'vitest'

import type { GridTile } from '../../src/lib/grid'
import { Hex } from '../../src/lib/hex'
import { State } from '../../src/lib/types/state'
import { Team } from '../../src/lib/types/team'
import { serializeGridState, unpackDisplayFlags } from '../../src/utils/gridStateSerializer'

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

describe('gridStateSerializer', () => {
  describe('serializeGridState', () => {
    it('serializes empty grid', () => {
      const tiles: GridTile[] = []
      const result = serializeGridState(tiles, null, null)

      expect(result).toEqual({})
    })

    it('serializes grid with only default tiles (state === 0)', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.DEFAULT),
        createMockTile(2, State.DEFAULT),
        createMockTile(3, State.DEFAULT),
      ]
      const result = serializeGridState(tiles, null, null)

      expect(result).toEqual({})
    })

    it('serializes only non-default tiles', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.DEFAULT), // Should be filtered out
        createMockTile(2, State.OCCUPIED_ALLY),
        createMockTile(3, State.DEFAULT), // Should be filtered out
        createMockTile(4, State.OCCUPIED_ENEMY),
        createMockTile(5, State.BLOCKED),
      ]
      const result = serializeGridState(tiles, null, null)

      expect(result).toEqual({
        t: [
          [2, State.OCCUPIED_ALLY],
          [4, State.OCCUPIED_ENEMY],
          [5, State.BLOCKED],
        ],
      })
    })

    it('serializes characters with their positions and teams', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.DEFAULT), // No character
        createMockTile(3, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
        createMockTile(4, State.OCCUPIED_ALLY, 10001, Team.ALLY), // Companion
      ]
      const result = serializeGridState(tiles, null, null)

      expect(result).toEqual({
        t: [
          [1, State.OCCUPIED_ALLY],
          [3, State.OCCUPIED_ENEMY],
          [4, State.OCCUPIED_ALLY],
        ],
        c: [
          [1, 100, Team.ALLY],
          [3, 200, Team.ENEMY],
          [4, 10001, Team.ALLY],
        ],
      })
    })

    it('filters tiles with characterId but no team', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.OCCUPIED_ENEMY, 200, undefined), // Missing team
        createMockTile(3, State.OCCUPIED_ENEMY, 300, Team.ENEMY),
      ]
      const result = serializeGridState(tiles, null, null)

      expect(result.c).toEqual([
        [1, 100, Team.ALLY],
        [3, 300, Team.ENEMY],
      ])
    })

    it('filters tiles with team but no characterId', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.OCCUPIED_ENEMY, undefined, Team.ENEMY), // Missing characterId
        createMockTile(3, State.OCCUPIED_ENEMY, 300, Team.ENEMY),
      ]
      const result = serializeGridState(tiles, null, null)

      expect(result.c).toEqual([
        [1, 100, Team.ALLY],
        [3, 300, Team.ENEMY],
      ])
    })

    it('serializes ally artifact only', () => {
      const tiles: GridTile[] = []
      const result = serializeGridState(tiles, 3, null)

      expect(result).toEqual({
        a: [3, null],
      })
    })

    it('serializes enemy artifact only', () => {
      const tiles: GridTile[] = []
      const result = serializeGridState(tiles, null, 5)

      expect(result).toEqual({
        a: [null, 5],
      })
    })

    it('serializes both artifacts', () => {
      const tiles: GridTile[] = []
      const result = serializeGridState(tiles, 2, 4)

      expect(result).toEqual({
        a: [2, 4],
      })
    })

    it('does not include artifacts when both are null', () => {
      const tiles: GridTile[] = [createMockTile(1, State.OCCUPIED_ALLY)]
      const result = serializeGridState(tiles, null, null)

      expect(result.a).toBeUndefined()
    })

    it('serializes display flags with all true', () => {
      const tiles: GridTile[] = []
      const displayFlags = {
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
      }
      const result = serializeGridState(tiles, null, null, displayFlags)

      expect(result).toEqual({
        d: 0b1111, // All flags set
      })
    })

    it('serializes display flags with all false', () => {
      const tiles: GridTile[] = []
      const displayFlags = {
        showHexIds: false,
        showArrows: false,
        showPerspective: false,
        showSkills: false,
      }
      const result = serializeGridState(tiles, null, null, displayFlags)

      expect(result).toEqual({
        d: 0b0000, // No flags set
      })
    })

    it('serializes display flags with mixed values', () => {
      const tiles: GridTile[] = []
      const displayFlags = {
        showHexIds: true, // bit 0
        showArrows: false, // bit 1
        showPerspective: true, // bit 2
        showSkills: false, // bit 3
      }
      const result = serializeGridState(tiles, null, null, displayFlags)

      expect(result).toEqual({
        d: 0b0101, // Bits 0 and 2 set
      })
    })

    it('serializes display flags with partial values', () => {
      const tiles: GridTile[] = []
      const displayFlags = {
        showHexIds: true,
        // Other flags undefined
      }
      const result = serializeGridState(tiles, null, null, displayFlags)

      expect(result).toEqual({
        d: 0b0001, // Only bit 0 set
      })
    })

    it('serializes complete state with all components', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.DEFAULT), // Filtered out
        createMockTile(3, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
        createMockTile(4, State.BLOCKED), // Non-default but no character
      ]
      const displayFlags = {
        showHexIds: true,
        showArrows: true,
        showPerspective: false,
        showSkills: true,
      }
      const result = serializeGridState(tiles, 1, 2, displayFlags)

      expect(result).toEqual({
        t: [
          [1, State.OCCUPIED_ALLY],
          [3, State.OCCUPIED_ENEMY],
          [4, State.BLOCKED],
        ],
        c: [
          [1, 100, Team.ALLY],
          [3, 200, Team.ENEMY],
        ],
        a: [1, 2],
        d: 0b1011, // Bits 0, 1, and 3 set
      })
    })
  })

  describe('unpackDisplayFlags', () => {
    it('returns default values when undefined', () => {
      const result = unpackDisplayFlags(undefined)

      expect(result).toEqual({
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
      })
    })

    it('unpacks all flags true', () => {
      const result = unpackDisplayFlags(0b1111)

      expect(result).toEqual({
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
      })
    })

    it('unpacks all flags false', () => {
      const result = unpackDisplayFlags(0b0000)

      expect(result).toEqual({
        showHexIds: false,
        showArrows: false,
        showPerspective: false,
        showSkills: false,
      })
    })

    it('unpacks individual flag states correctly', () => {
      // Test each flag individually
      expect(unpackDisplayFlags(0b0001)).toEqual({
        showHexIds: true,
        showArrows: false,
        showPerspective: false,
        showSkills: false,
      })

      expect(unpackDisplayFlags(0b0010)).toEqual({
        showHexIds: false,
        showArrows: true,
        showPerspective: false,
        showSkills: false,
      })

      expect(unpackDisplayFlags(0b0100)).toEqual({
        showHexIds: false,
        showArrows: false,
        showPerspective: true,
        showSkills: false,
      })

      expect(unpackDisplayFlags(0b1000)).toEqual({
        showHexIds: false,
        showArrows: false,
        showPerspective: false,
        showSkills: true,
      })
    })

    it('unpacks mixed flag states', () => {
      expect(unpackDisplayFlags(0b0101)).toEqual({
        showHexIds: true,
        showArrows: false,
        showPerspective: true,
        showSkills: false,
      })

      expect(unpackDisplayFlags(0b1010)).toEqual({
        showHexIds: false,
        showArrows: true,
        showPerspective: false,
        showSkills: true,
      })

      expect(unpackDisplayFlags(0b1100)).toEqual({
        showHexIds: false,
        showArrows: false,
        showPerspective: true,
        showSkills: true,
      })
    })

    it('ignores bits beyond the first 4', () => {
      const result = unpackDisplayFlags(0b11111111) // All 8 bits set

      expect(result).toEqual({
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
      })
    })
  })
})
