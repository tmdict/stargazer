import { describe, expect, it } from 'vitest'

import {
  ATTR_PARAGON,
  ATTR_REFINEMENT,
  attrDefault,
  attrMax,
  attrRowsFor,
  clampAttr,
  compareAttrRows,
  HERO_ATTRS,
  isKnownAttrId,
  type AttrRow,
} from '@/lib/characters/attributes'
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
    ])
    expect(ATTR_PARAGON).toBe(1)
    expect(ATTR_REFINEMENT).toBe(2)
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

  it('lookups answer for known and unknown ids', () => {
    expect(isKnownAttrId(1)).toBe(true)
    expect(isKnownAttrId(2)).toBe(true)
    expect(isKnownAttrId(0)).toBe(false)
    expect(isKnownAttrId(63)).toBe(false)
    expect(attrMax(ATTR_PARAGON)).toBe(4)
    expect(attrDefault(ATTR_REFINEMENT)).toBe(0)
  })
})

describe('clampAttr', () => {
  it('clamps into the attr range and zeroes unknown or non-finite input', () => {
    expect(clampAttr(ATTR_PARAGON, 7)).toBe(4)
    expect(clampAttr(ATTR_PARAGON, -2)).toBe(0)
    expect(clampAttr(ATTR_REFINEMENT, 2.6)).toBe(3)
    expect(clampAttr(99, 3)).toBe(0)
    expect(clampAttr(ATTR_PARAGON, Number.NaN)).toBe(0)
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
