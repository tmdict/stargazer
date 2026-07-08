import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET, type GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import {
  BOARD_CONTENT_KEYS,
  mirrorGridState,
  serializeGridState,
  serializeMultiGridState,
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

    it('serializes paragon for base heroes, skipping zero, companions, and phantimals', () => {
      const companionId = COMPANION_ID_OFFSET + 100
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.OCCUPIED_ALLY, 101, Team.ALLY), // left at level 0
        createMockTile(3, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
        createMockTile(4, State.OCCUPIED_ALLY, companionId, Team.ALLY), // companion
        createMockTile(5, State.OCCUPIED_ALLY, toPhantimalId(1), Team.ALLY), // phantimal
      ]
      const levels = new Map<string, number>([
        [`${Team.ALLY}:100`, 4],
        [`${Team.ENEMY}:200`, 2],
        [`${Team.ALLY}:${companionId}`, 3],
        [`${Team.ALLY}:${toPhantimalId(1)}`, 3],
      ])
      const getParagon = (team: Team, characterId: number): number =>
        levels.get(`${team}:${characterId}`) ?? 0

      const result = serializeGridState(tiles, null, null, undefined, getParagon)
      expect(result.pr).toEqual([
        [Team.ALLY, 100, 4],
        [Team.ENEMY, 200, 2],
      ])
    })

    it('omits pr without getParagon or when every level is zero', () => {
      const tiles: GridTile[] = [createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY)]
      expect(serializeGridState(tiles, null, null).pr).toBeUndefined()
      expect(serializeGridState(tiles, null, null, undefined, () => 0).pr).toBeUndefined()
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
        showGridInfo: true,
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
        showGridInfo: false,
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
        showGridInfo: true,
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

    it('mirrors paragon entries (team flipped), dropping any whose hero is off-grid', () => {
      const result = mirrorGridState(
        {
          c: [
            [1, 100, Team.ALLY],
            [99, 200, Team.ENEMY], // 99 off-grid, so hero 200 is dropped
          ],
          pr: [
            [Team.ALLY, 100, 3],
            [Team.ENEMY, 200, 4],
          ],
        },
        mirror,
      )
      expect(result.pr).toEqual([[Team.ENEMY, 100, 3]])
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
    // All flags off; spread overrides on top for each case.
    const off = {
      showGridInfo: false,
      showArrows: false,
      showPerspective: false,
      showSkills: false,
      teamView: false,
      inverted: false,
      wrap: false,
    }

    it('returns the defaults when undefined', () => {
      expect(unpackDisplayFlags(undefined)).toEqual({
        ...off,
        showGridInfo: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
      })
    })

    it.each([
      [0b000000, off],
      [0b000001, { ...off, showGridInfo: true }],
      [0b000010, { ...off, showArrows: true }],
      [0b000100, { ...off, showPerspective: true }],
      [0b001000, { ...off, showSkills: true }],
      [0b010000, { ...off, teamView: true }],
      [0b100000, { ...off, inverted: true }],
      [0b1000000, { ...off, wrap: true }],
      [
        0b111111,
        {
          showGridInfo: true,
          showArrows: true,
          showPerspective: true,
          showSkills: true,
          teamView: true,
          inverted: true,
          wrap: false,
        },
      ],
    ])('unpacks flags %i correctly', (flags, expected) => {
      expect(unpackDisplayFlags(flags)).toEqual(expected)
    })

    it('ignores bits beyond the first 7', () => {
      expect(unpackDisplayFlags(0b11111111)).toEqual({
        showGridInfo: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
        teamView: true,
        inverted: true,
        wrap: true,
      })
    })

    it('round-trips all flags through pack and unpack', () => {
      const tiles: GridTile[] = []
      const original = {
        showGridInfo: true,
        showArrows: false,
        showPerspective: true,
        showSkills: false,
        teamView: true,
        inverted: true,
        wrap: true,
      }
      const packed = serializeGridState(tiles, null, null, original).d
      expect(unpackDisplayFlags(packed)).toEqual(original)
    })

    it('decodes URLs from before teamView/inverted existed (high bits unset) as false', () => {
      // An old packed value that used only bits 0-3.
      const legacyPacked = 0b01111
      expect(unpackDisplayFlags(legacyPacked)).toEqual({
        showGridInfo: true,
        showArrows: true,
        showPerspective: true,
        showSkills: true,
        teamView: false,
        inverted: false,
        wrap: false,
      })
    })
  })

  describe('BOARD_CONTENT_KEYS contract', () => {
    it('a maximal board emits exactly the registered content keys', () => {
      // Canonical saved-team data is rebuilt from BOARD_CONTENT_KEYS, so a new
      // GridState section that isn't registered there would be silently dropped
      // from every saved team. This board exercises every content section; when
      // adding a section, extend the fixture AND the key list together.
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.OCCUPIED_ALLY, toPhantimalId(1), Team.ALLY),
        createMockTile(3, State.BLOCKED),
      ]
      const state = serializeMultiGridState(
        [{ tiles, allyArtifact: 2, enemyArtifact: null, map: 'arena1', getParagon: () => 3 }],
        0,
      )
      expect(Object.keys(state.boards[0]!).sort()).toEqual([...BOARD_CONTENT_KEYS].sort())
    })
  })
})
