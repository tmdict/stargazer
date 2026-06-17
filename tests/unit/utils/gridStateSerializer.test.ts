import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import type { GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import {
  mirrorGridState,
  serializeGridState,
  unpackDisplayFlags,
} from '@/utils/gridStateSerializer'

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

    it('records tiles at their base state, dropping skill tiles that become default', () => {
      // baseTileState models a skill (e.g. Kulu): tile 18 reverts to the bare map
      // (default, so it drops out), tile 20 reverts to an available map tile.
      const tiles: GridTile[] = [
        createMockTile(18, State.BLOCKED),
        createMockTile(20, State.BLOCKED),
        createMockTile(4, State.BLOCKED),
      ]
      const baseTileState = (hexId: number, s: number) =>
        hexId === 18 ? State.DEFAULT : hexId === 20 ? State.AVAILABLE_ALLY : s
      const result = serializeGridState(tiles, null, null, undefined, baseTileState)

      expect(result.t).toEqual([
        [20, State.AVAILABLE_ALLY],
        [4, State.BLOCKED],
      ])
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

  describe('mirrorGridState', () => {
    // Fixed mirror for the tests (a symmetric pairing); anything else is off-grid.
    const PAIRS = new Map([
      [1, 44],
      [2, 45],
      [5, 40],
      [44, 1],
      [45, 2],
      [40, 5],
    ])
    const mirror = (hexId: number) => PAIRS.get(hexId)

    it('mirrors character hexes and flips their teams', () => {
      const result = mirrorGridState(
        {
          c: [
            [1, 100, Team.ALLY],
            [44, 200, Team.ENEMY],
          ],
        },
        mirror,
      )
      expect(result.c).toEqual([
        [44, 100, Team.ENEMY],
        [1, 200, Team.ALLY],
      ])
    })

    it('mirrors phantimal hexes and flips teams, keeping local ids', () => {
      const result = mirrorGridState({ p: [[5, 3, Team.ALLY]] }, mirror)
      expect(result.p).toEqual([[40, 3, Team.ENEMY]])
    })

    it('swaps the artifact slots', () => {
      expect(mirrorGridState({ a: [7, 9] }, mirror).a).toEqual([9, 7])
      expect(mirrorGridState({ a: [3, null] }, mirror).a).toEqual([null, 3])
    })

    it('keeps tile states at their hexes but vacates occupied ones, and passes d through', () => {
      const result = mirrorGridState(
        {
          t: [
            [1, State.OCCUPIED_ALLY],
            [44, State.OCCUPIED_ENEMY],
            [2, State.AVAILABLE_ALLY],
            [10, State.BLOCKED],
          ],
          d: 0b10101,
        },
        mirror,
      )
      // Map doesn't move; occupied -> available so placement re-sets occupancy.
      expect(result.t).toEqual([
        [1, State.AVAILABLE_ALLY],
        [44, State.AVAILABLE_ENEMY],
        [2, State.AVAILABLE_ALLY],
        [10, State.BLOCKED],
      ])
      expect(result.d).toBe(0b10101)
    })

    it('drops units whose mirror is off-grid', () => {
      const result = mirrorGridState(
        {
          c: [
            [1, 100, Team.ALLY],
            [99, 200, Team.ENEMY], // 99 has no mirror
          ],
        },
        mirror,
      )
      expect(result.c).toEqual([[44, 100, Team.ENEMY]])
    })

    it('round-trips: mirroring twice restores the original', () => {
      const state = {
        c: [
          [1, 100, Team.ALLY],
          [45, 200, Team.ENEMY],
        ],
        a: [7, 9],
      }
      const twice = mirrorGridState(mirrorGridState(state, mirror), mirror)
      expect(twice.c).toEqual(state.c)
      expect(twice.a).toEqual(state.a)
    })
  })

  describe('unpackDisplayFlags', () => {
    // All six flags off; spread overrides on top for each case.
    const off = {
      showHexIds: false,
      showArrows: false,
      showPerspective: false,
      showSkills: false,
      teamView: false,
      inverted: false,
    }

    it('returns the defaults when undefined', () => {
      expect(unpackDisplayFlags(undefined)).toEqual({
        ...off,
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
      })
    })

    it.each([
      [0b000000, off],
      [0b000001, { ...off, showHexIds: true }],
      [0b000010, { ...off, showArrows: true }],
      [0b000100, { ...off, showPerspective: true }],
      [0b001000, { ...off, showSkills: true }],
      [0b010000, { ...off, teamView: true }],
      [0b100000, { ...off, inverted: true }],
      [
        0b111111,
        {
          showHexIds: true,
          showArrows: true,
          showPerspective: true,
          showSkills: true,
          teamView: true,
          inverted: true,
        },
      ],
    ])('unpacks flags %i correctly', (flags, expected) => {
      expect(unpackDisplayFlags(flags)).toEqual(expected)
    })

    it('ignores bits beyond the first 6', () => {
      expect(unpackDisplayFlags(0b11111111)).toEqual({
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
        teamView: true,
        inverted: true,
      })
    })

    it('round-trips all flags through pack and unpack', () => {
      const tiles: GridTile[] = []
      const original = {
        showHexIds: true,
        showArrows: false,
        showPerspective: true,
        showSkills: false,
        teamView: true,
        inverted: true,
      }
      const packed = serializeGridState(tiles, null, null, original).d
      expect(unpackDisplayFlags(packed)).toEqual(original)
    })

    it('decodes URLs from before teamView/inverted existed (high bits unset) as false', () => {
      // An old packed value that used only bits 0-3.
      const legacyPacked = 0b01111
      expect(unpackDisplayFlags(legacyPacked)).toEqual({
        showHexIds: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
        teamView: false,
        inverted: false,
      })
    })
  })
})
