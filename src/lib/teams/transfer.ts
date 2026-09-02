/* Saved-team backup files: a versioned JSON envelope holding the whole library.
 * Import is merge-only (never replaces the library): records are re-validated
 * and canonicalized through the same rules as hydration, duplicates of existing
 * teams are skipped, and accepted records keep the file's id, so a team's
 * identity survives a round trip (external tooling and stored provenance key on
 * it). An id regenerates only when it can't be kept: already in use, or not
 * shaped like an id. This is the only place untrusted file content enters the
 * app, so parsing is exhaustive and a malformed envelope rejects the whole file
 * rather than half-importing. */

import { suffixedName, validateSavedTeam, type SavedTeam } from './savedTeam'

export interface TeamsExportFile {
  app: 'stargazer'
  kind: 'saved-teams'
  version: 1
  exportedAt: string
  teams: SavedTeam[]
}

/* `data` is url-safe base64, so '|' can never appear in it and the key splits
 * unambiguously even when the name contains '|'. */
const dedupeKey = (team: Pick<SavedTeam, 'data' | 'name'>): string => `${team.data}|${team.name}`

export function buildExport(teams: readonly SavedTeam[], exportedAt: string): TeamsExportFile {
  return {
    app: 'stargazer',
    kind: 'saved-teams',
    version: 1,
    exportedAt,
    teams: [...teams],
  }
}

export type ImportParseResult =
  { ok: true; teams: SavedTeam[]; skipped: number; conflicts: number } | { ok: false }

// Ids are inert strings (only compared and used as keys), so shape needs no
// more than a length cap; a failing id regenerates rather than rejecting the
// record.
const MAX_ID_LENGTH = 64

/* Parse an export file against the current library. Accepted records keep the
 * file's id unless it is already taken (an import must never collide with an
 * existing record) or overlong; those get fresh ids. An id held by an existing
 * team is the same-lineage case — an old export of a team edited since, which
 * the data|name dedupe can't catch — so that record also gets a marked name
 * and counts in `conflicts`; otherwise the library would show two same-named
 * teams with no explanation. Timestamps are preserved from the file. `skipped`
 * counts invalid records and duplicates (same canonical data + name as an
 * existing or already-accepted team). Cap enforcement stays with the caller,
 * which owns the library size. */
export function parseImport(raw: string, existing: readonly SavedTeam[]): ImportParseResult {
  let envelope: unknown
  try {
    envelope = JSON.parse(raw)
  } catch {
    return { ok: false }
  }
  if (typeof envelope !== 'object' || envelope === null) return { ok: false }
  const { app, kind, version, teams } = envelope as Record<string, unknown>
  if (app !== 'stargazer' || kind !== 'saved-teams' || version !== 1) return { ok: false }
  if (!Array.isArray(teams)) return { ok: false }

  const seen = new Set(existing.map(dedupeKey))
  const existingIds = new Set(existing.map((team) => team.id))
  const takenIds = new Set(existingIds)
  const accepted: SavedTeam[] = []
  let skipped = 0
  let conflicts = 0

  for (const record of teams) {
    const valid = validateSavedTeam(record)
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

  return { ok: true, teams: accepted, skipped, conflicts }
}
