/* Contract tests for the wire-id registry. The registry duplicates board
 * counts and enumerates maps by hand (it must stay a pure leaf), so these
 * tests enforce the two halves of that bargain: the ids are frozen (append-only
 * — reassigning one silently re-routes every existing link) and the registry
 * stays complete against the real TEAM_MODES / MAPS data it mirrors. */

import { describe, expect, it } from 'vitest'

import { MAPS } from '@/lib/maps'
import { TEAM_MODES } from '@/lib/teams/modes'
import {
  MAP_WIRE_IDS,
  mapKeyByWireId,
  mapWireIdByKey,
  WIRE_MODES,
  wireModeById,
  wireModeByKey,
} from '@/lib/teams/wire'

describe('wire registry', () => {
  it('pins the mode wire ids', () => {
    expect(WIRE_MODES).toEqual([
      { wireId: 0, key: 'arena', boardCount: 1 },
      { wireId: 1, key: '1v1', boardCount: 1 },
      { wireId: 2, key: '3v3', boardCount: 3 },
      { wireId: 3, key: '5v5', boardCount: 5 },
      { wireId: 4, key: '5v5sl', boardCount: 5 },
    ])
  })

  it('pins the map wire ids', () => {
    expect(MAP_WIRE_IDS).toEqual({
      arena1: 1,
      arena2: 2,
      arena3: 3,
      arena4: 4,
      arena5: 5,
      arena5sp: 6,
      'preset-as1': 7,
      'preset-as2': 8,
      'preset-as3': 9,
      'preset-as4': 10,
      'preset-sr1': 11,
      'preset-sr2': 12,
      'preset-sr3': 13,
      'preset-sr4': 14,
      'preset-sr5': 15,
      'preset-sr6': 16,
      'preset-sr7': 17,
      'preset-sr8': 18,
      'preset-sr9': 19,
      'preset-sr10': 20,
      'preset-sr11': 21,
    })
  })

  it('covers every team mode with the real board count', () => {
    for (const [key, config] of Object.entries(TEAM_MODES)) {
      const wire = wireModeByKey(key)
      expect(wire, `mode ${key} missing from WIRE_MODES`).toBeDefined()
      expect(wire!.boardCount, `mode ${key} board count`).toBe(config.boardCount)
    }
  })

  it('includes arena as wire mode 0', () => {
    expect(wireModeByKey('arena')).toEqual({ wireId: 0, key: 'arena', boardCount: 1 })
  })

  it('covers every map and reserves 0 for "no map"', () => {
    for (const key of Object.keys(MAPS)) {
      expect(mapWireIdByKey(key), `map ${key} missing from MAP_WIRE_IDS`).toBeGreaterThan(0)
    }
    expect(mapKeyByWireId(0)).toBeUndefined()
  })

  it('keeps ids unique so reverse lookups are unambiguous', () => {
    const modeIds = WIRE_MODES.map((mode) => mode.wireId)
    expect(new Set(modeIds).size).toBe(modeIds.length)
    const mapIds = Object.values(MAP_WIRE_IDS)
    expect(new Set(mapIds).size).toBe(mapIds.length)
  })

  it('keeps mode and map ids inside their wire fields (3 and 6 bits)', () => {
    for (const mode of WIRE_MODES) {
      expect(mode.wireId).toBeLessThan(8)
      // The 3-bit active field indexes boards 0-7; a larger mode needs a
      // format change, not just a registry entry.
      expect(mode.boardCount).toBeLessThanOrEqual(8)
    }
    for (const id of Object.values(MAP_WIRE_IDS)) {
      expect(id).toBeLessThan(64)
    }
  })

  it('round-trips lookups both ways', () => {
    for (const mode of WIRE_MODES) {
      expect(wireModeById(mode.wireId)).toBe(mode)
    }
    for (const [key, id] of Object.entries(MAP_WIRE_IDS)) {
      expect(mapKeyByWireId(id)).toBe(key)
    }
  })
})
