/* Rosters: named hero pools with each hero's upgrade levels. A roster decides
 * which heroes the picker offers and the levels a hero starts with when it is
 * placed from the picker; boards, saved teams and links never refer to one.
 * The stored and exported shapes are documented in docs/architecture/TEAMS.md.
 *
 * `heroes` maps a real hero id to its level record, the same sparse AttrRecord
 * boards keep (lib/characters/attributes), so a new upgrade attribute needs no
 * roster change. A key present means the hero is owned; `{}` is owned at
 * default levels. Records are canonical (ids ascending, unknown attributes
 * dropped, levels clamped, defaults omitted), so equal content is byte-equal. */

import { attrDefault, clampAttr, isKnownAttrId, type AttrRecord } from './characters/attributes'
import { isRealHeroId } from './characters/character'
import { mergeImport, readExportFile, type MergeResult } from './exportFile'
import { sanitizeName } from './names'

export const MAX_ROSTERS = 100

export interface Roster {
  id: string
  name: string
  heroes: Record<string, AttrRecord>
  createdAt: number
  updatedAt: number
}

export interface RostersExportFile {
  app: 'stargazer'
  kind: 'rosters'
  exportedAt: string
  rosters: Roster[]
}

export function canonicalLevels(raw: unknown): AttrRecord {
  const levels: AttrRecord = {}
  if (typeof raw !== 'object' || raw === null) return levels
  for (const [id, value] of Object.entries(raw)) {
    const attrId = Number(id)
    if (!isKnownAttrId(attrId) || typeof value !== 'number') continue
    const clamped = clampAttr(attrId, value)
    if (clamped !== attrDefault(attrId)) levels[attrId] = clamped
  }
  return levels
}

// Integer-like keys enumerate in ascending order, so rebuilding the object is
// what sorts it.
function canonicalHeroes(raw: unknown): Record<string, AttrRecord> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const heroes: Record<string, AttrRecord> = {}
  for (const [key, value] of Object.entries(raw)) {
    const heroId = Number(key)
    if (!Number.isInteger(heroId) || heroId < 1 || !isRealHeroId(heroId)) continue
    heroes[heroId] = canonicalLevels(value)
  }
  return heroes
}

/* Validate one record from storage or an import file: a normalized roster, or
 * null. A hero entry that is not a real hero id drops alone. */
export function validateRoster(record: unknown): Roster | null {
  if (typeof record !== 'object' || record === null) return null
  const { id, name, heroes, createdAt, updatedAt } = record as Record<string, unknown>
  if (typeof id !== 'string' || id.length === 0) return null
  const cleanName = sanitizeName(name)
  if (!cleanName) return null
  const cleanHeroes = canonicalHeroes(heroes)
  if (!cleanHeroes) return null
  return {
    id,
    name: cleanName,
    heroes: cleanHeroes,
    createdAt: typeof createdAt === 'number' ? createdAt : 0,
    updatedAt: typeof updatedAt === 'number' ? updatedAt : 0,
  }
}

export function buildRostersExport(
  rosters: readonly Roster[],
  exportedAt: string,
): RostersExportFile {
  return { app: 'stargazer', kind: 'rosters', exportedAt, rosters: [...rosters] }
}

export function parseRostersImport(
  raw: string,
  existing: readonly Roster[],
): MergeResult<Roster> | null {
  const records = readExportFile(raw, 'rosters', 'rosters')
  if (records === null) return null
  return mergeImport(records, existing, validateRoster, (roster) => JSON.stringify(roster.heroes))
}
