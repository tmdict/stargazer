import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import type { GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { serializeGridState, unpackDisplayFlags } from '@/utils/gridStateSerializer'

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

describe('gridStateSerializer', () => {
  describe('serializeGridState', () => {
    it('serializes empty grid', () => {
      const tiles: GridTile[] = []
      const result = serializeGridState(tiles, null, null)
      expect(result).toEqual({})
    })

    it('filters out default state tiles', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.DEFAULT),
        createMockTile(2, State.OCCUPIED_ALLY),
        createMockTile(3, State.DEFAULT),
        createMockTile(4, State.BLOCKED),
      ]
      const result = serializeGridState(tiles, null, null)

      expect(result).toEqual({
        t: [
          [2, State.OCCUPIED_ALLY],
          [4, State.BLOCKED],
        ],
      })
    })

    it('serializes characters with positions and teams', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.DEFAULT),
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

    it('filters incomplete character data', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.OCCUPIED_ENEMY, 200, undefined), // Missing team
        createMockTile(3, State.OCCUPIED_ENEMY, undefined, Team.ENEMY), // Missing characterId
        createMockTile(4, State.OCCUPIED_ENEMY, 300, Team.ENEMY),
      ]
      const result = serializeGridState(tiles, null, null)

      expect(result.c).toEqual([
        [1, 100, Team.ALLY],
        [4, 300, Team.ENEMY],
      ])
    })

    it.each([
      [3, null, [3, null]],
      [null, 5, [null, 5]],
      [2, 4, [2, 4]],
    ])('serializes artifacts (%s, %s)', (ally, enemy, expected) => {
      const tiles: GridTile[] = []
      const result = serializeGridState(tiles, ally, enemy)
      expect(result).toEqual({ a: expected })
    })

    it('extracts phantimals into p with local IDs, keeping them out of c', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(5, State.OCCUPIED_ENEMY, toPhantimalId(3), Team.ENEMY),
      ]
      const result = serializeGridState(tiles, null, null)
      expect(result.c).toEqual([[1, 100, Team.ALLY]])
      expect(result.p).toEqual([[5, 3, Team.ENEMY]])
    })

    it('serializes display flags', () => {
      const tiles: GridTile[] = []
      const displayFlags = {
        showHexIds: true,
        showArrows: false,
        showPerspective: true,
        showSkills: false,
      }
      const result = serializeGridState(tiles, null, null, displayFlags)
      expect(result).toEqual({ d: 0b00101 })
    })

    it('serializes teamView in display flags (bit 4)', () => {
      const tiles: GridTile[] = []
      const result = serializeGridState(tiles, null, null, {
        showHexIds: false,
        showArrows: false,
        showPerspective: false,
        showSkills: false,
        teamView: true,
      })
      expect(result).toEqual({ d: 0b10000 })
    })

    it('serializes complete state with all components', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.DEFAULT),
        createMockTile(3, State.BLOCKED),
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
          [3, State.BLOCKED],
        ],
        c: [[1, 100, Team.ALLY]],
        a: [1, 2],
        d: 0b01011,
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
        teamView: false,
      })
    })

    it.each([
      [
        0b00000,
        {
          showHexIds: false,
          showArrows: false,
          showPerspective: false,
          showSkills: false,
          teamView: false,
        },
      ],
      [
        0b00001,
        {
          showHexIds: true,
          showArrows: false,
          showPerspective: false,
          showSkills: false,
          teamView: false,
        },
      ],
      [
        0b00010,
        {
          showHexIds: false,
          showArrows: true,
          showPerspective: false,
          showSkills: false,
          teamView: false,
        },
      ],
      [
        0b00100,
        {
          showHexIds: false,
          showArrows: false,
          showPerspective: true,
          showSkills: false,
          teamView: false,
        },
      ],
      [
        0b01000,
        {
          showHexIds: false,
          showArrows: false,
          showPerspective: false,
          showSkills: true,
          teamView: false,
        },
      ],
      [
        0b00101,
        {
          showHexIds: true,
          showArrows: false,
          showPerspective: true,
          showSkills: false,
          teamView: false,
        },
      ],
      [
        0b01010,
        {
          showHexIds: false,
          showArrows: true,
          showPerspective: false,
          showSkills: true,
          teamView: false,
        },
      ],
      [
        0b10000,
        {
          showHexIds: false,
          showArrows: false,
          showPerspective: false,
          showSkills: false,
          teamView: true,
        },
      ],
      [
        0b11111,
        {
          showHexIds: true,
          showArrows: true,
          showPerspective: true,
          showSkills: true,
          teamView: true,
        },
      ],
    ])('unpacks flags %i correctly', (flags, expected) => {
      expect(unpackDisplayFlags(flags)).toEqual(expected)
    })

    it('ignores bits beyond the first 5', () => {
      const result = unpackDisplayFlags(0b11111111)
      expect(result).toEqual({
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
        teamView: true,
      })
    })

    it('round-trips teamView through pack and unpack', () => {
      const tiles: GridTile[] = []
      const original = {
        showHexIds: true,
        showArrows: false,
        showPerspective: true,
        showSkills: false,
        teamView: true,
      }
      const packed = serializeGridState(tiles, null, null, original).d
      expect(unpackDisplayFlags(packed)).toEqual(original)
    })

    it('decodes URLs from before teamView existed (bit 4 unset) as teamView=false', () => {
      // Simulate an old URL where the packed value uses only bits 0-3.
      const legacyPacked = 0b01111
      expect(unpackDisplayFlags(legacyPacked)).toEqual({
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
        teamView: false,
      })
    })
  })
})
