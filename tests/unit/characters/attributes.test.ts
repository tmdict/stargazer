import { describe, expect, it } from 'vitest'

import {
  ATTR_PARAGON,
  ATTR_REFINEMENT,
  ATTR_SKILL_MODE,
  attrRowsFor,
  clampAttr,
  compareAttrRows,
  HERO_ATTRS,
  type AttrRow,
} from '@/lib/characters/attributes'
import { toSynergyId } from '@/lib/characters/synergy'
import { SKILL_MODES } from '@/lib/skills/skillModes'
import { Team } from '@/lib/types/team'

/* Contract test: the registry is append-only and shared by the serializer,
 * the binary codec (whose generic upgrades section has a 4-bit value field),
 * canonicalization, and the state layer. Changing an existing row here is a
 * breaking format change; only appending is legal. */
describe('HERO_ATTRS contract', () => {
  it('pins the registered attrs exactly', () => {
    expect(HERO_ATTRS).toEqual([
      { id: 1, name: 'paragon', max: 4, default: 0 },
      { id: 2, name: 'refinement', max: 4, default: 0 },
      { id: 3, name: 'skill-mode', max: 15, default: 0 },
    ])
    expect(ATTR_PARAGON).toBe(1)
    expect(ATTR_REFINEMENT).toBe(2)
    expect(ATTR_SKILL_MODE).toBe(3)
  })

  // A stored skill mode is a position in its hero's list, so the lists are
  // append-only too.
  it('pins every skill mode list in order', () => {
    const names = Object.fromEntries(
      Object.entries(SKILL_MODES).map(([id, entry]) => [id, entry.modes.map((m) => m.name)]),
    )
    expect(names).toEqual({
      57: ['spellbind', 'curelock'],
      78: ['lightning-fire-dragon-mode', 'fire-dragon-king-mode'],
    })
  })

  it('every skill mode list fits the 4-bit value field', () => {
    for (const entry of Object.values(SKILL_MODES)) {
      expect(entry.modes.length).toBeGreaterThanOrEqual(2)
      expect(entry.modes.length).toBeLessThanOrEqual(16)
    }
  })

  it('every attr fits the binary codec fields (attrId 1-63, max 0-15)', () => {
    for (const attr of HERO_ATTRS) {
      expect(attr.id).toBeGreaterThanOrEqual(1)
      expect(attr.id).toBeLessThanOrEqual(63)
      expect(attr.max).toBeGreaterThanOrEqual(0)
      expect(attr.max).toBeLessThanOrEqual(15)
      expect(attr.default).toBeGreaterThanOrEqual(0)
      expect(attr.default).toBeLessThanOrEqual(attr.max)
    }
  })
})

describe('clampAttr', () => {
  it('clamps into the attr range and zeroes unknown or non-finite input', () => {
    expect(clampAttr(ATTR_PARAGON, 7, 43)).toBe(4)
    expect(clampAttr(ATTR_PARAGON, -2, 43)).toBe(0)
    expect(clampAttr(ATTR_REFINEMENT, 2.6, 43)).toBe(3)
    expect(clampAttr(99, 3, 43)).toBe(0)
    expect(clampAttr(ATTR_PARAGON, Number.NaN, 43)).toBe(0)
  })

  it("clamps a skill mode to the hero's own modes, by exact id", () => {
    expect(clampAttr(ATTR_SKILL_MODE, 1, 57)).toBe(1)
    // Past the last mode reads as the last mode.
    expect(clampAttr(ATTR_SKILL_MODE, 2, 57)).toBe(1)
    // Valen has no modes, and a synergy copy cannot hold one.
    expect(clampAttr(ATTR_SKILL_MODE, 1, 43)).toBe(0)
    expect(clampAttr(ATTR_SKILL_MODE, 1, toSynergyId(57))).toBe(0)
  })
})

describe('attr rows', () => {
  it('emits sparse rows and sorts by team, character, attr', () => {
    const rows: AttrRow[] = [
      ...attrRowsFor(Team.ENEMY, 20, { 1: 2 }),
      ...attrRowsFor(Team.ALLY, 30, { 2: 1, 1: 0 }),
      ...attrRowsFor(Team.ALLY, 10, { 1: 4, 2: 3 }),
      ...attrRowsFor(Team.ALLY, 11, {}),
      ...attrRowsFor(Team.ALLY, 12, { 99: 5 }),
    ]
    expect(rows.sort(compareAttrRows)).toEqual([
      [Team.ALLY, 10, 1, 4],
      [Team.ALLY, 10, 2, 3],
      [Team.ALLY, 30, 2, 1],
      [Team.ENEMY, 20, 1, 2],
    ])
  })
})
