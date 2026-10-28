import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { FormationReading, UnitReading } from '@/lib/import/screens/formation/types'
import {
  assignUnits,
  heroesFromUnits,
  identifyMap,
  missingUnits,
  portraitOptions,
  replayPlacing,
} from '@/lib/teams/formationImport'
import { Team } from '@/lib/types/team'

// Code-registered companion skills, each companion with a picture of its own:
// Zanie's two turrets share one, Elijah & Lailah's companion is Lailah, and
// Wedge of Matter (phantimal 5) brings Wedge of Power.
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
    const assigned = assignUnits(units, [ZANIE, 11, 12], {}, () => true)
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

  it('ranks Elijah and Lailah under pictures of their own, so each can be sure', () => {
    const LAILAH = COMPANION_ID_OFFSET + ELIJAH_LAILAH
    const units = [
      unit(1, { [ELIJAH_LAILAH]: 0.9, [LAILAH]: 0.5 }),
      unit(2, { [LAILAH]: 0.85, [ELIJAH_LAILAH]: 0.55 }),
    ]
    expect(assignUnits(units, [ELIJAH_LAILAH], {}, () => true)).toEqual([
      { unitId: ELIJAH_LAILAH, state: 'sure' },
      { unitId: LAILAH, state: 'sure' },
    ])
  })

  it('leaves a portrait unlike any art to the unit left over, for review', () => {
    const units = [unit(1, { [ELIJAH_LAILAH]: 0.5 }), unit(2, { 7: 0.7 })]
    const assigned = assignUnits(units, [ELIJAH_LAILAH], {}, () => true)
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
    const assigned = assignUnits(units, [11], { 0: null, 3: 11 }, () => true)
    expect(assigned.map((a) => a.unitId)).toEqual([null, WEDGE, WEDGE_POWER, 11])
  })

  it('takes a portrait of a phantimal the heroes do not qualify for as none of their units', () => {
    // Hero 12 misread on the result shot: the shown phantimal no longer fits,
    // and its portrait still resembles hero 12 enough to be taken for it.
    const units = [unit(1, { 11: 0.9 }), unit(2, { [WEDGE]: 0.85, 12: 0.3 })]
    expect(assignUnits(units, [11, 12], {}, () => false)).toEqual([
      { unitId: 11, state: 'sure' },
      { unitId: null, state: 'none' },
    ])
    // A review pick of it, made while they qualified, is none of them either.
    expect(assignUnits(units, [11, 12], { 1: WEDGE }, () => false)[1]).toEqual({
      unitId: null,
      state: 'none',
    })
  })
})

describe('missingUnits', () => {
  it('places the family of the phantimal the portraits field and offers no other phantimal', () => {
    const other = toPhantimalId(1)
    const options = [11, WEDGE, WEDGE_POWER, other]
    const shown = missingUnits(
      [11],
      [
        { unitId: 11, hexId: 1 },
        { unitId: WEDGE, hexId: 2 },
      ],
      options,
      {},
    )
    expect(shown.options).not.toContain(other)
    expect(shown.order).toEqual([WEDGE_POWER])
    // A companion shown alone still fields its phantimal, which then goes to a tile.
    const companion = missingUnits(
      [11],
      [
        { unitId: 11, hexId: 1 },
        { unitId: WEDGE_POWER, hexId: 3 },
      ],
      options,
      {},
    )
    expect(companion.order).toEqual([WEDGE])
  })

  it("places the lineup's phantimal for a shot short of heroes, and none for one showing every hero", () => {
    const options = [11, 12, WEDGE, WEDGE_POWER]
    // The panel cannot draw a hero the account lacks, and drops its phantimal with it.
    const short = missingUnits([11, 12], [{ unitId: 11, hexId: 1 }], options, {})
    expect(short.order).toEqual([12, WEDGE, WEDGE_POWER])
    const whole = missingUnits(
      [11, 12],
      [
        { unitId: 11, hexId: 1 },
        { unitId: 12, hexId: 2 },
      ],
      options,
      {},
    )
    expect(whole.order).toEqual([])
  })
})

describe('replayPlacing', () => {
  it("places the lineup's phantimal after the heroes until another is picked", () => {
    const other = toPhantimalId(1)
    const options = [11, 12, WEDGE, WEDGE_POWER, other]
    expect(replayPlacing([11, 12], options, {}).order).toEqual([11, 12, WEDGE, WEDGE_POWER])
    expect(replayPlacing([11, 12], options, { 3: other }).order).toEqual([11, 12, other])
    // A lineup qualifying for none places its heroes alone.
    expect(replayPlacing([11, 12], [11, 12], {}).order).toEqual([11, 12])
  })
})

describe('portraitOptions', () => {
  it("offers the other portraits' phantimal family only, and each portrait its own unit", () => {
    const other = toPhantimalId(1)
    const options = [11, WEDGE, WEDGE_POWER, other]
    // A companion on another portrait fields its phantimal too.
    expect(portraitOptions(options, [11, WEDGE_POWER, null], 2)).toEqual([11, WEDGE, WEDGE_POWER])
    // The one phantimal portrait may change to another phantimal.
    expect(portraitOptions(options, [11, WEDGE, null], 1)).toEqual(options)
    // Two phantimals read: either portrait can be corrected.
    expect(portraitOptions(options, [other, WEDGE], 0)).toEqual(options)
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
