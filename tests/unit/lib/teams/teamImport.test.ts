import { describe, expect, it } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import type { HeroReading, ScreenshotReading } from '@/lib/import/types'
import {
  buildTeamImportPlan,
  cellState,
  isBlockingIssue,
  mapResultsFrom,
  overrideKey,
  reviewStates,
  suggestRecordName,
  type PlanIssue,
  type ShotAssignment,
} from '@/lib/teams/teamImport'
import { Team } from '@/lib/types/team'

const hero = (characterId: number, paragon = 4, refinement = 0): HeroReading => ({
  box: { x: 0, y: 0, w: 1, h: 1 },
  card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
  candidates: [{ characterId, score: 0.8, learned: false, costume: false }],
  recognised: true,
  margin: 0.3,
  sure: true,
  descriptor: new Float32Array(1),
  paragon: { level: paragon, score: 0.7, runnerUp: 0.4, sure: true },
  refinement: { level: refinement, stars: 6, family: 'white' },
})

const reading = (
  ally: number[],
  enemy: number[],
  extra: Partial<ScreenshotReading> = {},
): ScreenshotReading => ({
  mapIndex: null,
  mapCount: null,
  winner: Team.ALLY,
  mapResults: [],
  sides: { [Team.ALLY]: ally.map((id) => hero(id)), [Team.ENEMY]: enemy.map((id) => hero(id)) },
  artifacts: {
    [Team.ALLY]: { candidates: [{ artifactId: 14, score: 0.4 }], margin: 0.1 },
    [Team.ENEMY]: null,
  },
  warnings: [],
  ...extra,
})

const shot = (
  mapIndex: number | null,
  r: ScreenshotReading,
  overrides: ShotAssignment['overrides'] = {},
): ShotAssignment => ({
  reading: r,
  mapIndex,
  winner: r.winner,
  overrides,
  artifactOverrides: {},
})

const NAMES = { prefix: 'S7 SL5 Group', left: 'GNX', right: '10' }

describe('suggestRecordName', () => {
  it('follows the pvp export convention', () => {
    const results = [Team.ALLY, Team.ENEMY, Team.ALLY, Team.ALLY, Team.ALLY]
    expect(suggestRecordName(NAMES, results)).toBe('S7 SL5 Group - GNX > 10 (1,3,4,5 > 2)')
    expect(suggestRecordName(NAMES, [Team.ENEMY, Team.ENEMY, Team.ALLY])).toBe(
      'S7 SL5 Group - GNX < 10 (3 < 1,2)',
    )
    expect(suggestRecordName({ ...NAMES, prefix: '' }, [null, Team.ALLY])).toBe('GNX > 10 (2 > )')
    expect(suggestRecordName(NAMES, [Team.ENEMY])).toBe('S7 SL5 Group - GNX < 10')
  })
})

describe('mapResultsFrom', () => {
  it("prefers a mapped screenshot's own tab, then the strip majority", () => {
    const a = shot(
      0,
      reading([], [], { winner: Team.ENEMY, mapResults: [Team.ENEMY, Team.ALLY, null] }),
    )
    const b = shot(
      2,
      reading([], [], { winner: Team.ALLY, mapResults: [Team.ALLY, Team.ALLY, Team.ALLY] }),
    )
    expect(mapResultsFrom([a, b], 3)).toEqual([Team.ENEMY, Team.ALLY, Team.ALLY])
  })

  it('takes the reviewed winner over the reading', () => {
    const a = { ...shot(0, reading([], [], { winner: Team.ALLY })), winner: Team.ENEMY }
    expect(mapResultsFrom([a], 1)).toEqual([Team.ENEMY])
  })
})

describe('buildTeamImportPlan', () => {
  it('skips a screenshot with no heroes on either side', () => {
    const r = reading([1, 2], [3])
    for (const cell of [...r.sides[Team.ALLY], ...r.sides[Team.ENEMY]]) {
      cell.candidates = []
      cell.recognised = false
    }
    const plan = buildTeamImportPlan([shot(0, r)], '3v3', NAMES)
    expect(plan.boards[0]).toBeNull()
    expect(plan.issues).toEqual([{ kind: 'empty', count: 1 }])
  })

  it('maps screenshots to boards with attrs, overrides, and artifacts', () => {
    const r = reading([1, 2, 3], [4, 5, 6])
    r.sides[Team.ALLY][0]!.refinement.level = 4
    const plan = buildTeamImportPlan(
      [shot(1, r, { [overrideKey(Team.ENEMY, 0)]: { characterId: 40, paragon: 2 } })],
      '3v3',
      NAMES,
    )
    expect(plan.boards[0]).toBeNull()
    const board = plan.boards[1]!
    expect(board.sides[Team.ALLY].map((e) => e.characterId)).toEqual([1, 2, 3])
    expect(board.sides[Team.ALLY][0]!.attrs).toEqual({ [ATTR_PARAGON]: 4, [ATTR_REFINEMENT]: 4 })
    expect(board.sides[Team.ENEMY][0]).toEqual({ characterId: 40, attrs: { [ATTR_PARAGON]: 2 } })
    expect(board.artifacts).toEqual({ ally: 14, enemy: null })
    expect(plan.issues).toEqual([])
  })

  it('drops a removed cell and flags duplicate maps, unmapped shots, and cross-board duplicates', () => {
    const r1 = reading([1, 2], [3])
    const r2 = reading([2, 9], [8])
    const plan = buildTeamImportPlan(
      [
        shot(0, r1, { [overrideKey(Team.ALLY, 0)]: { characterId: null } }),
        shot(1, r2),
        shot(1, reading([7], [7])),
        shot(null, reading([], [])),
      ],
      '3v3',
      NAMES,
    )
    expect(plan.boards[0]!.sides[Team.ALLY].map((e) => e.characterId)).toEqual([2])
    expect(plan.issues).toContainEqual({ kind: 'duplicate-map', mapIndex: 1 })
    expect(plan.issues).toContainEqual({ kind: 'unmapped', count: 1 })
    expect(plan.issues).toContainEqual({
      kind: 'cross-board-duplicate',
      team: Team.ALLY,
      characterId: 2,
      maps: [0, 1],
    })
  })

  it('blocks a hero picked for two cells of one side and keeps its first cell', () => {
    const r = reading([1, 2, 3], [4])
    const plan = buildTeamImportPlan(
      [shot(0, r, { [overrideKey(Team.ALLY, 2)]: { characterId: 1 } })],
      '3v3',
      NAMES,
    )
    expect(plan.boards[0]!.sides[Team.ALLY].map((e) => e.characterId)).toEqual([1, 2])
    const issue: PlanIssue = {
      kind: 'duplicate-hero',
      team: Team.ALLY,
      characterId: 1,
      mapIndex: 0,
    }
    expect(plan.issues).toContainEqual(issue)
    expect(isBlockingIssue(issue)).toBe(true)
  })

  it('blocks the same artifact on the same side of two boards', () => {
    const plan = buildTeamImportPlan(
      [shot(0, reading([1], [2])), shot(2, reading([3], [4]))],
      '3v3',
      NAMES,
    )
    const issue: PlanIssue = {
      kind: 'cross-board-artifact',
      team: Team.ALLY,
      artifactId: 14,
      maps: [0, 2],
    }
    expect(plan.issues).toContainEqual(issue)
    expect(isBlockingIssue(issue)).toBe(true)
  })

  it('counts a map beyond the mode as unmapped', () => {
    const plan = buildTeamImportPlan([shot(4, reading([1], [2]))], '3v3', NAMES)
    expect(plan.boards.every((b) => b === null)).toBe(true)
    expect(plan.issues).toContainEqual({ kind: 'unmapped', count: 1 })
  })

  it('fills the opposite board sides when swapped, with issues named by board side', () => {
    const plan = buildTeamImportPlan(
      [
        shot(0, reading([1, 2], [3]), { [overrideKey(Team.ALLY, 1)]: { characterId: 1 } }),
        shot(1, reading([1], [4])),
      ],
      '3v3',
      NAMES,
      true,
    )
    const board = plan.boards[0]!
    expect(board.sides[Team.ALLY].map((e) => e.characterId)).toEqual([3])
    expect(board.sides[Team.ENEMY].map((e) => e.characterId)).toEqual([1])
    expect(board.artifacts).toEqual({ ally: null, enemy: 14 })
    expect(plan.issues).toContainEqual({
      kind: 'duplicate-hero',
      team: Team.ENEMY,
      characterId: 1,
      mapIndex: 0,
    })
    expect(plan.issues).toContainEqual({
      kind: 'cross-board-duplicate',
      team: Team.ENEMY,
      characterId: 1,
      maps: [0, 1],
    })
    expect(plan.issues).toContainEqual({
      kind: 'cross-board-artifact',
      team: Team.ENEMY,
      artifactId: 14,
      maps: [0, 1],
    })
    // The record name follows the players, whichever side they fill.
    expect(plan.suggestedName).toBe('S7 SL5 Group - GNX > 10 (1,2 > )')
  })

  it('says when the map wins are equal or unread instead of claiming a winner', () => {
    const unread = buildTeamImportPlan([shot(0, reading([1], [2], { winner: null }))], '1v1', NAMES)
    expect(unread.suggestedName).toBe('S7 SL5 Group - GNX > 10')
    expect(unread.issues).toEqual([{ kind: 'result-undecided' }])
    expect(isBlockingIssue({ kind: 'result-undecided' })).toBe(false)

    const tied = buildTeamImportPlan(
      [shot(0, reading([1], [2])), shot(1, reading([3], [4], { winner: Team.ENEMY }))],
      '3v3',
      NAMES,
    )
    expect(tied.issues).toContainEqual({ kind: 'result-undecided' })

    const decided = buildTeamImportPlan([shot(0, reading([1], [2]))], '3v3', NAMES)
    expect(decided.issues).toEqual([])
    expect(buildTeamImportPlan([], '3v3', NAMES).issues).toEqual([])
  })
})

describe('review state', () => {
  it('needs both the hero and the paragon to be sure, and lets an edit settle each', () => {
    const cell = hero(1)
    expect(cellState(cell)).toBe('sure')
    cell.paragon.sure = false
    expect(cellState(cell)).toBe('review')
    expect(cellState(cell, { paragon: 4 })).toBe('sure')
    cell.paragon.sure = true
    cell.sure = false
    expect(cellState(cell)).toBe('review')
    expect(cellState(cell, { characterId: 9 })).toBe('sure')
    expect(cellState(cell, { characterId: null })).toBe('sure')
  })

  it('is none for an unrecognised cell until a hero is picked', () => {
    const cell = hero(1)
    cell.candidates = []
    cell.recognised = false
    cell.sure = false
    expect(cellState(cell)).toBe('none')
    expect(cellState(cell, { characterId: 5 })).toBe('sure')
    expect(cellState(cell, { paragon: 3 })).toBe('none')
  })

  it('marks both cells that end up with the same hero', () => {
    const r = reading([1, 2, 3], [])
    r.sides[Team.ALLY][1]!.sure = false
    const overrides = { [overrideKey(Team.ALLY, 2)]: { characterId: 1 } }
    expect(reviewStates(r, Team.ALLY, overrides)).toEqual(['duplicate', 'review', 'duplicate'])
    expect(reviewStates(r, Team.ALLY, {})).toEqual(['sure', 'review', 'sure'])
  })
})
