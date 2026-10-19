import { describe, expect, it } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { HeroReading, ScreenshotReading, UnitReading } from '@/lib/import/types'
import {
  buildTeamImportPlan,
  cellState,
  isBlockingIssue,
  mapResultsFrom,
  overrideKey,
  reviewStates,
  suggestRecordName,
  type FormationAssignment,
  type PlanIssue,
  type ShotAssignment,
  type TeamImportPlan,
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
  refinement: { level: refinement, stars: 6, family: 'white', sure: true },
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
    [Team.ALLY]: {
      card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
      candidates: [{ artifactId: 14, score: 0.4 }],
      margin: 0.1,
      sure: true,
    },
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

// The heroes a plan puts on one side of a board, in card order.
const heroesOn = (plan: TeamImportPlan, mapIndex: number, team: Team): number[] =>
  plan.boards[mapIndex]?.sides[team]?.mains.map((unit) => unit.unitId) ?? []

describe('suggestRecordName', () => {
  it.each([
    { prefix: '', left: '', right: '' },
    { ...NAMES, left: '  ' },
    { ...NAMES, right: '' },
  ])('leaves the record name blank without both players: %j', (names) => {
    expect(suggestRecordName(names, [Team.ALLY, Team.ENEMY, Team.ALLY])).toBe('')
  })

  it("formats the match's record name", () => {
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
  it('allows unnamed imports without a record-name result warning', () => {
    const plan = buildTeamImportPlan([shot(0, reading([1], [2], { winner: null }))], '1v1', {
      prefix: 'S7',
      left: '',
      right: '',
    })
    expect(heroesOn(plan, 0, Team.ALLY)).toEqual([1])
    expect(plan.suggestedName).toBe('')
    expect(plan.issues).toEqual([])
  })

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
    const { sides } = plan.boards[1]!
    expect(heroesOn(plan, 1, Team.ALLY)).toEqual([1, 2, 3])
    expect(sides[Team.ALLY]!.mains[0]!.attrs).toEqual({ [ATTR_PARAGON]: 4, [ATTR_REFINEMENT]: 4 })
    expect(sides[Team.ENEMY]!.mains[0]).toEqual({ unitId: 40, attrs: { [ATTR_PARAGON]: 2 } })
    expect([sides[Team.ALLY]!.artifact, sides[Team.ENEMY]!.artifact]).toEqual([14, null])
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
    expect(heroesOn(plan, 0, Team.ALLY)).toEqual([2])
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
    expect(heroesOn(plan, 0, Team.ALLY)).toEqual([1, 2])
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
    const { sides } = plan.boards[0]!
    expect(heroesOn(plan, 0, Team.ALLY)).toEqual([3])
    expect(heroesOn(plan, 0, Team.ENEMY)).toEqual([1])
    expect([sides[Team.ALLY]!.artifact, sides[Team.ENEMY]!.artifact]).toEqual([null, 14])
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
    // The name reads by board half: the Ally column's player fills the enemy
    // half here, so they are listed second, with their map wins.
    expect(plan.suggestedName).toBe('S7 SL5 Group - 10 < GNX ( < 1,2)')
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

describe('buildTeamImportPlan with formation shots', () => {
  const ZANIE = 89
  const TURRET = COMPANION_ID_OFFSET + ZANIE
  const ARENA1_ALLY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 16]
  const ARENA1_ENEMY = [30, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]

  const unit = (hexId: number, characterId: number): UnitReading => ({
    hexId,
    ring: { x: 0, y: 0, radius: 1 },
    score: 1,
    candidates: [{ characterId, score: 0.9, learned: false, costume: false }],
    card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
  })

  const formationShot = (
    side: Team,
    units: UnitReading[],
    cards: HeroReading[] = [],
    mapIndex = 0,
  ): FormationAssignment => ({
    reading: {
      ...reading([], []),
      sides: {
        [Team.ALLY]: side === Team.ALLY ? cards : [],
        [Team.ENEMY]: side === Team.ENEMY ? cards : [],
      },
      size: { width: 640, height: 760 },
      board: { scale: 46, x: 0, y: 0, support: 0.7 },
      side,
      tiles: side === Team.ALLY ? ARENA1_ALLY : ARENA1_ENEMY,
      unclear: [],
      units,
    },
    mapIndex,
    overrides: {},
    artifactOverrides: {},
    unitOverrides: {},
  })

  it("places the result shot's lineup on the tiles its formation shot shows", () => {
    const formations = [
      formationShot(Team.ALLY, [unit(1, ZANIE), unit(2, 1), unit(5, TURRET), unit(3, TURRET)]),
    ]
    const plan = buildTeamImportPlan(
      [shot(0, reading([ZANIE, 1], [2]))],
      '5v5',
      NAMES,
      false,
      formations,
    )
    const board = plan.boards[0]!
    expect(board.sides[Team.ALLY]!.mains).toEqual([
      { unitId: ZANIE, hexId: 1, attrs: { [ATTR_PARAGON]: 4 } },
      { unitId: 1, hexId: 2, attrs: { [ATTR_PARAGON]: 4 } },
    ])
    expect(board.sides[Team.ALLY]!.companions).toEqual([
      { unitId: TURRET, hexId: 3, mainUnitId: ZANIE },
      { unitId: COMPANION_ID_OFFSET * 2 + ZANIE, hexId: 5, mainUnitId: ZANIE },
    ])
    // The enemy side has no formation shot, so its heroes take random tiles.
    expect(board.sides[Team.ENEMY]!.mains).toEqual([{ unitId: 2, attrs: { [ATTR_PARAGON]: 4 } }])
    expect(board.formations).toEqual([Team.ALLY])
    expect(board.map).toBe('arena1')
  })

  it('fills only the side a formation shot shows, from its own cards, when its board has no result', () => {
    const cards = [hero(1, 3, 2), hero(2, 0, 0)]
    const formations = [formationShot(Team.ENEMY, [unit(40, 1)], cards)]
    const plan = buildTeamImportPlan([], '5v5', NAMES, false, formations)
    const { sides } = plan.boards[0]!
    expect(sides[Team.ALLY]).toBeUndefined()
    expect(sides[Team.ENEMY]!.mains).toEqual([
      { unitId: 1, hexId: 40, attrs: { [ATTR_PARAGON]: 3, [ATTR_REFINEMENT]: 2 } },
      { unitId: 2, hexId: undefined, attrs: {} },
    ])
    expect(plan.issues).toContainEqual({
      kind: 'unplaced',
      team: Team.ENEMY,
      mapIndex: 0,
      count: 1,
    })
  })

  it('turns a formation a half-turn onto the other half when the sides are swapped', () => {
    const formations = [formationShot(Team.ALLY, [unit(1, 7)])]
    const plan = buildTeamImportPlan([shot(0, reading([7], [8]))], '5v5', NAMES, true, formations)
    expect(plan.boards[0]!.sides[Team.ENEMY]!.mains).toEqual([
      { unitId: 7, hexId: 45, attrs: { [ATTR_PARAGON]: 4 } },
    ])
    expect(plan.boards[0]!.formations).toEqual([Team.ENEMY])
  })

  it('leaves out a formation shot whose map has no result shot in a match import', () => {
    const formations = [formationShot(Team.ALLY, [unit(1, 7)], [hero(7)], 1)]
    const plan = buildTeamImportPlan([shot(0, reading([7], [8]))], '5v5', NAMES, false, formations)
    expect(plan.boards[1]).toBeNull()
    const issue: PlanIssue = { kind: 'formation-unused', team: Team.ALLY, mapIndex: 1 }
    expect(plan.issues).toContainEqual(issue)
    expect(isBlockingIssue(issue)).toBe(false)
  })

  it('names no match record for formation shots alone', () => {
    const plan = buildTeamImportPlan([], '5v5', NAMES, false, [
      formationShot(Team.ALLY, [unit(1, 7)], [hero(7)]),
    ])
    expect(plan.suggestedName).toBe('')
    expect(plan.issues.map((i) => i.kind)).not.toContain('result-undecided')
  })

  it('blocks two formation shots of one side of a board', () => {
    const formations = [
      formationShot(Team.ALLY, [unit(1, 7)]),
      formationShot(Team.ALLY, [unit(2, 7)]),
    ]
    const plan = buildTeamImportPlan([shot(0, reading([7], [8]))], '5v5', NAMES, false, formations)
    const issue: PlanIssue = { kind: 'duplicate-formation', team: Team.ALLY, mapIndex: 0 }
    expect(plan.issues).toContainEqual(issue)
    expect(isBlockingIssue(issue)).toBe(true)
  })
})

describe('buildTeamImportPlan with replay frames', () => {
  it("places each column's heroes on the tiles picked for them, the rest on random tiles", () => {
    const plan = buildTeamImportPlan(
      [shot(0, reading([7, 9], [8]))],
      '5v5',
      NAMES,
      false,
      [],
      [{ mapIndex: 0, picks: { [Team.ALLY]: { 1: 7 }, [Team.ENEMY]: { 40: 8 } } }],
    )
    const board = plan.boards[0]!
    expect(board.sides[Team.ALLY]!.mains).toEqual([
      { unitId: 7, hexId: 1, attrs: { [ATTR_PARAGON]: 4 } },
      { unitId: 9, hexId: undefined, attrs: { [ATTR_PARAGON]: 4 } },
    ])
    expect(board.sides[Team.ENEMY]!.mains).toEqual([
      { unitId: 8, hexId: 40, attrs: { [ATTR_PARAGON]: 4 } },
    ])
    expect(plan.issues).toContainEqual({ kind: 'unplaced', team: Team.ALLY, mapIndex: 0, count: 1 })
    // No phantimal was picked, so each side gets the one its lineup qualifies for.
    expect(board.formations).toEqual([])
  })

  it('keeps a picked phantimal and turns the picks a half-turn when the sides are swapped', () => {
    const phantimal = toPhantimalId(1)
    const plan = buildTeamImportPlan(
      [shot(0, reading([7], [8]))],
      '5v5',
      NAMES,
      true,
      [],
      [{ mapIndex: 0, picks: { [Team.ALLY]: { 1: 7, 3: phantimal } } }],
    )
    const enemy = plan.boards[0]!.sides[Team.ENEMY]!
    expect(enemy.mains).toEqual([{ unitId: 7, hexId: 45, attrs: { [ATTR_PARAGON]: 4 } }])
    expect(enemy.phantimal).toEqual({ unitId: phantimal, hexId: 43 })
    expect(plan.boards[0]!.formations).toEqual([Team.ENEMY])
  })

  it('blocks two replay frames of one board and leaves out one whose map has no result', () => {
    const plan = buildTeamImportPlan(
      [shot(0, reading([7], [8]))],
      '5v5',
      NAMES,
      false,
      [],
      [
        { mapIndex: 0, picks: {} },
        { mapIndex: 0, picks: {} },
        { mapIndex: 1, picks: {} },
      ],
    )
    const duplicate: PlanIssue = { kind: 'duplicate-replay', mapIndex: 0 }
    const unused: PlanIssue = { kind: 'replay-unused', mapIndex: 1 }
    expect(plan.issues).toContainEqual(duplicate)
    expect(plan.issues).toContainEqual(unused)
    expect(isBlockingIssue(duplicate)).toBe(true)
    expect(isBlockingIssue(unused)).toBe(false)
    expect(plan.boards[1]).toBeNull()
  })
})

describe('review state', () => {
  it('needs both the hero and the paragon to be sure, and lets an edit settle each', () => {
    const cell = hero(1)
    expect(cellState(cell)).toBe('sure')
    cell.paragon.sure = false
    expect(cellState(cell)).toBe('paragon')
    expect(cellState(cell, { paragon: 4 })).toBe('sure')
    cell.paragon.sure = true
    cell.sure = false
    expect(cellState(cell)).toBe('review')
    expect(cellState(cell, { characterId: 9 })).toBe('sure')
    expect(cellState(cell, { characterId: null })).toBe('sure')
  })

  it('asks about an unsure refinement last, and lets an edit settle it', () => {
    const cell = hero(1, 4, 1)
    cell.refinement.sure = false
    expect(cellState(cell)).toBe('refinement')
    expect(cellState(cell, { refinement: 1 })).toBe('sure')
    cell.paragon.sure = false
    expect(cellState(cell)).toBe('paragon')
    expect(cellState(cell, { paragon: 4 })).toBe('refinement')
    expect(cellState(cell, { characterId: null })).toBe('sure')
  })

  it('identifies the remaining paragon check after the hero is corrected', () => {
    const cell = hero(1)
    cell.sure = false
    cell.paragon.sure = false
    expect(cellState(cell)).toBe('review')
    expect(cellState(cell, { characterId: 9 })).toBe('paragon')
    expect(cellState(cell, { characterId: 9, paragon: 4 })).toBe('sure')
    expect(cellState(cell, { paragon: 4 })).toBe('review')
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
