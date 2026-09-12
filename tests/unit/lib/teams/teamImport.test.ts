import { describe, expect, it } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import type { HeroReading, ScreenshotReading } from '@/lib/import/types'
import {
  buildTeamImportPlan,
  mapResultsFrom,
  overrideKey,
  suggestRecordName,
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
})
