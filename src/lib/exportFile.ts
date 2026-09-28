/* Stargazer export files: a JSON object naming the app and the kind of file,
 * plus one array of records. Import is merge-only and shared by every library
 * that exports (saved teams, rosters): records are re-validated, duplicates of
 * existing records are skipped, and accepted records keep their id so a
 * record's identity survives a round trip. This is where untrusted file content
 * enters the app, so a malformed file is rejected whole rather than
 * half-imported. */

import { suffixedName } from './names'

// The records under `listKey`, or null when the file is not this kind.
export function readExportFile(raw: string, kind: string, listKey: string): unknown[] | null {
  let file: unknown
  try {
    file = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof file !== 'object' || file === null) return null
  const fields = file as Record<string, unknown>
  if (fields.app !== 'stargazer' || fields.kind !== kind) return null
  const records = fields[listKey]
  return Array.isArray(records) ? records : null
}

export interface MergeResult<T> {
  accepted: T[]
  skipped: number
  conflicts: number
}

export interface ImportOutcome {
  imported: number
  skipped: number
  conflicts: number
  // The file itself was rejected; the library is untouched.
  invalid: boolean
}

/* Appends a merge's accepted records to the library (mutated in place) until
 * it holds `cap`; records past the cap count as skipped. A null merge is a
 * rejected file. */
export function importInto<T>(
  library: T[],
  merged: MergeResult<T> | null,
  cap: number,
): ImportOutcome {
  if (!merged) return { imported: 0, skipped: 0, conflicts: 0, invalid: true }
  let imported = 0
  let skipped = merged.skipped
  for (const record of merged.accepted) {
    if (library.length >= cap) skipped++
    else {
      library.push(record)
      imported++
    }
  }
  return { imported, skipped, conflicts: merged.conflicts, invalid: false }
}

// Ids are inert strings (only compared and used as keys), so shape needs no
// more than a length cap; a failing id regenerates rather than rejecting the
// record.
const MAX_ID_LENGTH = 64

/* Accepted records keep their id unless it is already taken (an import must
 * never collide with an existing record) or overlong; those get fresh ids. An
 * id held by an existing record is the same-lineage case (an old export of a
 * record edited since, which the content-plus-name dedupe can't catch), so
 * that record also gets a marked name and counts in `conflicts`; otherwise the
 * library would show two same-named records with no explanation. `skipped`
 * counts invalid records and duplicates (same content key and name as an
 * existing or already-accepted record). Cap enforcement stays with the caller,
 * which owns the library size. */
export function mergeImport<T extends { id: string; name: string }>(
  records: readonly unknown[],
  existing: readonly T[],
  validate: (record: unknown) => T | null,
  contentKey: (record: T) => string,
): MergeResult<T> {
  // Content keys never contain '|', so the pair splits unambiguously even when
  // a name does.
  const dedupeKey = (record: T): string => `${contentKey(record)}|${record.name}`
  const seen = new Set(existing.map(dedupeKey))
  const existingIds = new Set(existing.map((record) => record.id))
  const takenIds = new Set(existingIds)
  const accepted: T[] = []
  let skipped = 0
  let conflicts = 0

  for (const record of records) {
    const valid = validate(record)
    if (!valid) {
      skipped++
      continue
    }
    const key = dedupeKey(valid)
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    if (existingIds.has(valid.id)) {
      conflicts++
      accepted.push({
        ...valid,
        id: crypto.randomUUID(),
        name: suffixedName(valid.name, ' (imported)'),
      })
      continue
    }
    const id =
      valid.id.length <= MAX_ID_LENGTH && !takenIds.has(valid.id) ? valid.id : crypto.randomUUID()
    takenIds.add(id)
    accepted.push({ ...valid, id })
  }

  return { accepted, skipped, conflicts }
}
