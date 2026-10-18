import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { FormationReading, UnitReading } from '@/lib/import/types'
import {
  assignUnits,
  formationSide,
  heroesFromUnits,
  identifyMap,
} from '@/lib/teams/formationImport'
import { Team } from '@/lib/types/team'

// Code-registered companion skills: Zanie's two turrets share an image of
// their own; Elijah & Lailah's companion is drawn with their art; Wedge of
// Matter (phantimal 5) brings Wedge of Power, also with an image of its own.
const ZANIE = 89
const TURRET = COMPANION_ID_OFFSET + ZANIE
const ELIJAH_LAILAH = 68
const WEDGE = toPhantimalId(5)
const WEDGE_POWER = COMPANION_ID_OFFSET + WEDGE

const ARENA1_ALLY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 16]

const unit = (hexId: number, scores: Record<number, number>): UnitReading => ({
  hexId,
  ring: { x: 0, y: 0, radius: 1 },
  score: 1,
  candidates: Object.entries(scores)
    .map(([id, score]) => ({ characterId: Number(id), score, learned: false, costume: false }))
    .sort((a, b) => b.score - a.score),
  card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
})

const formation = (
  side: Team,
  units: UnitReading[],
  tiles: number[] = ARENA1_ALLY,
  unclear: number[] = [],
): FormationReading => ({
  size: { width: 640, height: 760 },
  mapIndex: 0,
  mapCount: 5,
  winner: null,
  mapResults: [],
  sides: { [Team.ALLY]: [], [Team.ENEMY]: [] },
  artifacts: { [Team.ALLY]: null, [Team.ENEMY]: null },
  warnings: [],
  board: { scale: 46, x: 0, y: 0, support: 0.7 },
  side,
  tiles,
  unclear,
  units,
})

describe('assignUnits', () => {
  it('takes each portrait for the lineup unit it matches, companions in tile order', () => {
    const units = [
      unit(1, { [ZANIE]: 0.9 }),
      unit(4, { [TURRET]: 0.8 }),
      unit(3, { [TURRET]: 0.85 }),
      unit(2, { 11: 0.8 }),
      unit(5, { 12: 0.7, 11: 0.65 }),
    ]
    const assigned = assignUnits(units, [ZANIE, 11, 12], {})
    expect(assigned.map((a) => a.unitId)).toEqual([
      ZANIE,
      COMPANION_ID_OFFSET * 2 + ZANIE,
      TURRET,
      11,
      12,
    ])
    // Hero 12 leads hero 11 by too little to be sure.
    expect(assigned.map((a) => a.state)).toEqual(['sure', 'sure', 'sure', 'sure', 'review'])
  })

  it('leaves a portrait unlike any art to the unit left over, for review', () => {
    const units = [unit(1, { [ELIJAH_LAILAH]: 0.5 }), unit(2, { 7: 0.7 })]
    const assigned = assignUnits(units, [ELIJAH_LAILAH], {})
    expect(assigned).toEqual([
      { unitId: ELIJAH_LAILAH, state: 'review' },
      { unitId: COMPANION_ID_OFFSET + ELIJAH_LAILAH, state: 'review' },
    ])
  })

  it('adds the phantimal the portraits show, and keeps a review pick as made', () => {
    const units = [
      unit(1, { 11: 0.9 }),
      unit(2, { [WEDGE]: 0.8 }),
      unit(3, { [WEDGE_POWER]: 0.82 }),
      unit(4, { 11: 0.7 }),
    ]
    const assigned = assignUnits(units, [11], { 0: null, 3: 11 })
    expect(assigned.map((a) => a.unitId)).toEqual([null, WEDGE, WEDGE_POWER, 11])
  })
})

describe('heroesFromUnits', () => {
  it("takes each portrait's best hero once, leaving a taken hero's companion to it", () => {
    const units = [
      unit(1, { 5: 0.9 }),
      unit(2, { 5: 0.7, 6: 0.65 }),
      unit(3, { [ELIJAH_LAILAH]: 0.9 }),
      unit(4, { [ELIJAH_LAILAH]: 0.8, 7: 0.75 }),
    ]
    expect(heroesFromUnits(units)).toEqual([5, ELIJAH_LAILAH, 6])
  })
})

describe('identifyMap', () => {
  it('names the candidate whose tiles for the shown side the lit tiles are', () => {
    const reading = formation(Team.ALLY, [unit(16, {})], ARENA1_ALLY.slice(1), [1])
    expect(identifyMap(reading, ['arena2', 'arena1'])).toBe('arena1')
  })

  it('names none when a unit stands off the map or a tile is missing', () => {
    expect(identifyMap(formation(Team.ALLY, [unit(30, {})]), ['arena1'])).toBeNull()
    expect(identifyMap(formation(Team.ALLY, [], ARENA1_ALLY.slice(1)), ['arena1'])).toBeNull()
  })
})

describe('formationSide', () => {
  it('turns every tile a half-turn for a team landing on the other half', () => {
    const units = [unit(1, {}), unit(16, {})]
    const assignments = [
      { unitId: 11, state: 'sure' as const },
      { unitId: 12, state: 'sure' as const },
    ]
    const heroes = [
      { characterId: 11, attrs: {} },
      { characterId: 12, attrs: {} },
      { characterId: 13, attrs: {} },
    ]
    const side = formationSide(units, assignments, heroes, null, true)
    expect(side.mains.map((m) => [m.unitId, m.hexId])).toEqual([
      [11, 45],
      [12, 30],
      [13, undefined],
    ])
  })
})
