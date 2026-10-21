/* Contract tests for the wire-id registry. The mode table duplicates board
 * counts by hand (the file must stay a pure leaf), so these tests pin the ids
 * in use (reassigning one silently re-routes every live link) and keep the
 * table complete against the real TEAM_MODES data it mirrors. Map ids are the
 * arena files' own; here they only have to fit the wire field. The mode table
 * grows only for a new board count: an in-game mode on an existing count is a
 * TEAM_VARIANTS row and has no wire presence. */

import { describe, expect, it } from 'vitest'

import { MAPS } from '@/lib/maps'
import { TEAM_MODES } from '@/lib/teams/modes'
import { mapKeyByWireId, wireModeById, wireModeByKey } from '@/lib/teams/wire'

describe('wire registry', () => {
  it('pins the mode wire ids: arena plus exactly the TEAM_MODES board counts', () => {
    // Every id the 3-bit mode field can carry.
    const modes = Array.from({ length: 8 }, (_, id) => wireModeById(id)).filter(Boolean)
    expect(modes).toEqual([
      { wireId: 0, key: 'arena', boardCount: 1 },
      { wireId: 1, key: '1v1', boardCount: 1 },
      { wireId: 2, key: '3v3', boardCount: 3 },
      { wireId: 3, key: '5v5', boardCount: 5 },
    ])
    expect(modes.map((mode) => mode!.key)).toEqual(['arena', ...Object.keys(TEAM_MODES)])
  })

  it('covers every team mode with the real board count', () => {
    for (const [key, config] of Object.entries(TEAM_MODES)) {
      const wire = wireModeByKey(key)
      expect(wire, `mode ${key} missing from WIRE_MODES`).toBeDefined()
      expect(wire!.boardCount, `mode ${key} board count`).toBe(config.boardCount)
    }
  })

  it('keeps map ids inside their 6-bit wire field', () => {
    for (const [key, { id }] of Object.entries(MAPS)) {
      expect(id, `map ${key}`).toBeLessThan(64)
    }
    expect(mapKeyByWireId(0), 'map id 0 is "no map"').toBeUndefined()
  })
})
