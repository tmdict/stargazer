import { describe, expect, it, vi } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { toSynergyId } from '@/lib/characters/synergy'
import { buildSideLoadPlan, savedTeamSide } from '@/lib/teams/sideLoad'
import { Team } from '@/lib/types/team'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

const encode = (state: MultiGridState): string => encodeMultiGridStateToUrl(state)

// One 1v1 board exercising every unit section: mains, a companion, a
// phantimal, the synergy hero with its companion, paragon for both teams,
// and an ally artifact.
const ALLY_RECORD: MultiGridState = {
  boards: [
    {
      m: 'arena1',
      c: [
        [1, 11, Team.ALLY],
        [2, 12, Team.ALLY],
        [3, 10012, Team.ALLY],
      ],
      s: [[4, 1, Team.ALLY]],
      y: [
        [5, 16, Team.ALLY],
        [6, 10016, Team.ALLY],
      ],
      p: [
        [Team.ALLY, 11, 3],
        [Team.ENEMY, 21, 2],
      ],
      a: [7, null],
    },
  ],
  mode: '1v1',
}

describe('savedTeamSide', () => {
  it('returns the single side all units share, across every section', () => {
    expect(savedTeamSide(encode(ALLY_RECORD))).toBe(Team.ALLY)
    expect(
      savedTeamSide(encode({ boards: [{ m: 'arena1', c: [[40, 21, Team.ENEMY]] }], mode: '1v1' })),
    ).toBe(Team.ENEMY)
  })

  it('spans the whole record: boards disagreeing on side disqualify', () => {
    const mixed: MultiGridState = {
      boards: [
        { m: 'arena1', c: [[1, 11, Team.ALLY]] },
        { m: 'arena1', c: [[40, 21, Team.ENEMY]] },
        { m: 'arena1' },
      ],
      mode: '3v3',
    }
    expect(savedTeamSide(encode(mixed))).toBeNull()
  })

  it('rejects a board mixing sides, even in different sections', () => {
    const mixed: MultiGridState = {
      boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]], s: [[40, 1, Team.ENEMY]] }],
      mode: '1v1',
    }
    expect(savedTeamSide(encode(mixed))).toBeNull()
  })

  it('rejects unit-less records (nothing to load) and corrupt team fields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(savedTeamSide(encode({ boards: [{ m: 'arena1' }], mode: '1v1' }))).toBeNull()
    expect(
      savedTeamSide(encode({ boards: [{ m: 'arena1', c: [[1, 11, 3]] }], mode: '1v1' })),
    ).toBeNull()
    expect(savedTeamSide('not-a-record')).toBeNull()
    warn.mockRestore()
  })
})

describe('buildSideLoadPlan', () => {
  it('maps mains with paragon, bands the phantimal and synergy hero, carries companions', () => {
    const plan = buildSideLoadPlan(encode(ALLY_RECORD), true)!
    expect(plan.side).toBe(Team.ALLY)
    expect(plan.boards).toHaveLength(1)

    const board = plan.boards[0]!
    expect(board.mains).toEqual([
      { unitId: 11, hexId: 1, paragon: 3 },
      { unitId: 12, hexId: 2, paragon: 0 },
      { unitId: toSynergyId(16), hexId: 5, paragon: 0 },
    ])
    // Companions become settle targets tied to their band-preserving main.
    expect(board.companions).toEqual([
      { unitId: 10012, hexId: 3, mainUnitId: 12 },
      { unitId: toSynergyId(10016), hexId: 6, mainUnitId: toSynergyId(16) },
    ])
    expect(board.phantimal).toEqual({ unitId: toPhantimalId(1), hexId: 4, paragon: 0 })
    expect(board.artifact).toBe(7)
  })

  it('strips the synergy hero and its companions when the mode has no Syn affordance', () => {
    const plan = buildSideLoadPlan(encode(ALLY_RECORD), false)!
    expect(plan.boards[0]!.mains.map((unit) => unit.unitId)).toEqual([11, 12])
    expect(plan.boards[0]!.companions).toEqual([{ unitId: 10012, hexId: 3, mainUnitId: 12 }])
  })

  it('drops crafted phantimal- and synergy-band values from the c section', () => {
    const crafted: MultiGridState = {
      boards: [
        {
          m: 'arena1',
          c: [
            [1, 11, Team.ALLY],
            [3, 100001, Team.ALLY],
            [5, 200016, Team.ALLY],
          ],
        },
      ],
      mode: '1v1',
    }
    const plan = buildSideLoadPlan(encode(crafted), true)!
    expect(plan.boards[0]!.mains.map((unit) => unit.unitId)).toEqual([11])
    expect(plan.boards[0]!.companions).toEqual([])
    expect(plan.boards[0]!.phantimal).toBeNull()
  })

  it('carries the enemy artifact slot for an enemy-side record', () => {
    const record: MultiGridState = {
      boards: [{ m: 'arena1', c: [[40, 21, Team.ENEMY]], a: [null, 9] }],
      mode: '1v1',
    }
    const plan = buildSideLoadPlan(encode(record), true)!
    expect(plan.side).toBe(Team.ENEMY)
    expect(plan.boards[0]!.artifact).toBe(9)
  })

  it('is null for records the side rule disqualifies', () => {
    const mixed: MultiGridState = {
      boards: [
        {
          m: 'arena1',
          c: [
            [1, 11, Team.ALLY],
            [40, 21, Team.ENEMY],
          ],
        },
      ],
      mode: '1v1',
    }
    expect(buildSideLoadPlan(encode(mixed), true)).toBeNull()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(buildSideLoadPlan('not-a-record', true)).toBeNull()
    warn.mockRestore()
  })
})
