import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET, type GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import {
  BOARD_CONTENT_KEYS,
  serializeGridState,
  serializeMultiGridState,
  unpackDisplayFlags,
} from '@/utils/gridStateSerializer'

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
      expect(result.p).toEqual([
        [Team.ALLY, 100, 4],
        [Team.ENEMY, 200, 2],
      ])
    })

    it('omits p without getParagon or when every level is zero', () => {
      const tiles: GridTile[] = [createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY)]
      expect(serializeGridState(tiles, null, null).p).toBeUndefined()
      expect(serializeGridState(tiles, null, null, undefined, () => 0).p).toBeUndefined()
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
      const companionId = COMPANION_ID_OFFSET + 1
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.DEFAULT),
        createMockTile(3, State.OCCUPIED_ENEMY, 200, Team.ENEMY),
        createMockTile(4, State.OCCUPIED_ALLY, companionId, Team.ALLY),
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
          [4, companionId, Team.ALLY],
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

    it('extracts phantimals into s with local IDs, keeping them out of c', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(5, State.OCCUPIED_ENEMY, toPhantimalId(3), Team.ENEMY),
      ]
      const result = serializeGridState(tiles, null, null)
      expect(result.c).toEqual([[1, 100, Team.ALLY]])
      expect(result.s).toEqual([[5, 3, Team.ENEMY]])
    })

    it('serializes display flags', () => {
      const tiles: GridTile[] = []
      const displayFlags = {
        showGridInfo: true,
        showPerspective: true,
        showSkills: false,
      }
      const result = serializeGridState(tiles, null, null, displayFlags)
      expect(result).toEqual({ d: 0b011 })
    })

    it('serializes teamView in display flags (bit 3)', () => {
      const tiles: GridTile[] = []
      const result = serializeGridState(tiles, null, null, {
        showGridInfo: false,
        showPerspective: false,
        showSkills: false,
        teamView: true,
      })
      expect(result).toEqual({ d: 0b1000 })
    })

    it('serializes complete state with all components', () => {
      const tiles: GridTile[] = [
        createMockTile(1, State.OCCUPIED_ALLY, 100, Team.ALLY),
        createMockTile(2, State.DEFAULT),
        createMockTile(3, State.BLOCKED),
      ]
      const displayFlags = {
        showGridInfo: true,
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
        d: 0b101,
      })
    })
  })

  describe('unpackDisplayFlags', () => {
    // All flags off; spread overrides on top for each case.
    const off = {
      showGridInfo: false,
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
        showPerspective: true,
        showSkills: true,
      })
    })

    it.each([
      [0b000000, off],
      [0b000001, { ...off, showGridInfo: true }],
      [0b000010, { ...off, showPerspective: true }],
      [0b000100, { ...off, showSkills: true }],
      [0b001000, { ...off, teamView: true }],
      [0b010000, { ...off, inverted: true }],
      [0b100000, { ...off, wrap: true }],
      [
        0b011111,
        {
          showGridInfo: true,
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

    it('ignores bits beyond the first 6', () => {
      expect(unpackDisplayFlags(0b11111111)).toEqual({
        showGridInfo: true,
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
        showPerspective: true,
        showSkills: false,
        teamView: true,
        inverted: true,
        wrap: true,
      }
      const packed = serializeGridState(tiles, null, null, original).d
      expect(unpackDisplayFlags(packed)).toEqual(original)
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
