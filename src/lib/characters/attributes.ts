/* Per-hero upgrade attribute registry: the single source of truth for every
 * levelled upgrade a hero carries (paragon, EX refinement, and whatever comes
 * next). Serialized as the GridState `u` section — uniform rows
 * [team, characterId, attrId, value] — and held in memory as per-hero records
 * keyed by attrId (useGridContext's attrs map).
 *
 * APPEND-ONLY: attrIds are never reused or renumbered; retiring an attribute
 * reserves its id forever. characterId 0 is reserved for future team-scoped
 * rows (hero ids start at 1). The binary link codec carries these same rows in
 * its generic upgrades section, whose 4-bit value field caps `max` at 15; the
 * registry contract test pins both.
 */

import { Team } from '@/lib/types/team'

export const ATTR_PARAGON = 1
export const ATTR_REFINEMENT = 2

export interface AttrConfig {
  id: number
  // Locale key suffix (app.<name>) and stable code-facing name.
  name: string
  max: number
  default: number
}

export const HERO_ATTRS: readonly AttrConfig[] = [
  { id: ATTR_PARAGON, name: 'paragon', max: 4, default: 0 },
  { id: ATTR_REFINEMENT, name: 'refinement', max: 4, default: 0 },
]

const BY_ID = new Map(HERO_ATTRS.map((attr) => [attr.id, attr]))

export const isKnownAttrId = (attrId: number): boolean => BY_ID.has(attrId)

export const attrMax = (attrId: number): number => BY_ID.get(attrId)?.max ?? 0

export const attrDefault = (attrId: number): number => BY_ID.get(attrId)?.default ?? 0

export const clampAttr = (attrId: number, value: number): number => {
  const config = BY_ID.get(attrId)
  if (!config || !Number.isFinite(value)) return 0
  return Math.min(Math.max(Math.round(value), 0), config.max)
}

/* One hero's attribute values, keyed by attrId; absent key = the attr's
 * default. Treated as a value object: transfers move the whole record. */
export type AttrRecord = Record<number, number>

export const emptyAttrs = (): AttrRecord => ({})

export const attrsAreDefault = (attrs: AttrRecord): boolean =>
  Object.entries(attrs).every(([id, value]) => value === attrDefault(Number(id)))

/* A serialized `u` row. */
export type AttrRow = [team: Team, characterId: number, attrId: number, value: number]

/* Canonical row order for emission, canonicalization, and legacy conversion —
 * one comparator so identical content is always byte-identical (the
 * unsaved-changes compare and import dedupe are byte compares). */
export const compareAttrRows = (a: AttrRow, b: AttrRow): number =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/* Sparse rows for one hero's record, unsorted (callers collect across heroes,
 * then sort once with compareAttrRows). */
export function attrRowsFor(team: Team, characterId: number, attrs: AttrRecord): AttrRow[] {
  const rows: AttrRow[] = []
  for (const [id, value] of Object.entries(attrs)) {
    const attrId = Number(id)
    if (isKnownAttrId(attrId) && value !== attrDefault(attrId)) {
      rows.push([team, characterId, attrId, value])
    }
  }
  return rows
}
