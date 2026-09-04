/* One-time conversion of stored/shared paragon data from the retired formats
 * (JSON `p` boards, binary bit-1 sections) to the `u` upgrade rows. All legacy
 * `p` knowledge lives here plus the tagged bit-1 decode branch in
 * binaryEncoder.ts; the serializer and every consumer know only `u`.
 *
 * Two halves. `convertLegacyBoard` runs inside decodeMultiGridStateFromUrl —
 * the single choke point for all multi-board JSON (library hydration, mode
 * slots, /teams?g= links, import files, previews, side-load) — so any legacy
 * payload converts the moment it is read. `runUpgradeStoragePass` runs once at
 * app startup and rewrites the at-rest keys (library records, the four mode
 * slots, the arena autosave) so stored data stops depending on the read-side
 * conversion before it is deleted.
 *
 * The pass is idempotent (`p` present + `u` absent converts; anything else
 * no-ops), so its marker is written LAST, only after every attempted write
 * landed — a failed write (quota; the library is the app's largest key) just
 * retries next load. This deliberately inverts gridInfoMigration's
 * marker-first discipline, which exists because that remap scrambles on
 * re-run; this one doesn't. Accepted races: two tabs both running the pass
 * write equivalent bytes; a stale pre-deploy tab autosaving `p`-form data
 * during the shim window is healed by the read-side conversion until removal.
 *
 * TEMPORARY, planned for deletion about a month after release.
 *
 * REMOVAL RUNBOOK (step-by-step, written for the LLM agent doing the
 * deletion):
 * 1. Delete this file (src/utils/upgradeMigration.ts).
 * 2. Delete tests/unit/utils/upgradeMigration.test.ts.
 * 3. Delete every `describe('upgradeMigration ...')` block in other test
 *    files (`grep -rn "upgradeMigration" tests` finds them); nothing else
 *    tests legacy `p` behavior.
 * 4. In src/utils/urlStateManager.ts: remove the convertLegacyBoard import
 *    and its call in decodeMultiGridStateFromUrl.
 * 5. In src/App.vue: remove the runUpgradeStoragePass import, its onMounted
 *    call, and the ordering comment above it.
 * 6. In src/utils/binaryEncoder.ts: remove the bit-1 legacy branch in
 *    decodeFromBinary, the LEGACY_PARAGON_* constants, and the two "legacy
 *    paragon" format-spec notes; extended-flags bit 1 is then free for
 *    future reuse.
 * 7. Trim shim mentions from docs/architecture/URL_SERIALIZATION.md and
 *    TEAMS.md.
 * 8. The stargazer.migration.u marker key stays behind in user storage as
 *    accepted residue (like gridInfoMigration's deliberate key duplication).
 * 9. Verify: `grep -ri upgrademigration src tests` returns nothing, then
 *    lint, type-check, and the test suite pass with no further edits.
 * Expected user-visible consequences, accepted by policy (old links and
 * exports are expendable): pre-release Teams links and export files lose
 * their paragon levels; pre-release Arena links that carried paragon stop
 * decoding and load an empty board.
 *
 * The storage keys are duplicated here (not exported from their owners) so
 * deleting this file leaves no orphaned exports behind.
 */

import { clampAttr, compareAttrRows, type AttrRow } from '@/lib/characters/attributes'
import { canonicalTeamData } from '@/lib/teams/savedTeam'
import { readStorage, writeStorage } from '@/utils/storage'
import {
  decodeGridStateFromUrl,
  decodeMultiGridStateFromUrl,
  encodeGridStateToUrl,
  encodeMultiGridStateToUrl,
} from '@/utils/urlStateManager'

const MARKER_KEY = 'stargazer.migration.u'
const ARENA_KEY = 'stargazer.arena'
const LIBRARY_KEY = 'stargazer.teams.saved'
const TEAM_MODE_KEYS = ['1v1', '3v3', '5v5', '5v5sl'] as const

/* Convert one decoded board in place: legacy `p` rows ([team, characterId,
 * level]) become `u` rows with attrId 1, filtered (length-3, finite numbers),
 * clamped, deduped last-wins, and sorted with the canonical comparator so a
 * converted record is byte-equal to a fresh snapshot of the same content.
 * `p` is always deleted — Teams ingress re-encodes decoded payloads, and a
 * stale `p` must never ride forward. */
export function convertLegacyBoard(board: Record<string, unknown>): void {
  const legacy = board.p
  if (legacy === undefined) return
  delete board.p
  if (board.u !== undefined || !Array.isArray(legacy)) return

  const byHero = new Map<string, AttrRow>()
  for (const row of legacy) {
    if (!Array.isArray(row) || row.length !== 3) continue
    const [team, characterId, level] = row as unknown[]
    if (typeof team !== 'number' || typeof characterId !== 'number' || typeof level !== 'number') {
      continue
    }
    if (!Number.isFinite(team) || !Number.isFinite(characterId) || !Number.isFinite(level)) continue
    const value = clampAttr(1, level)
    if (value > 0) byHero.set(`${team}:${characterId}`, [team, characterId, 1, value])
  }
  if (byHero.size > 0) {
    board.u = [...byHero.values()].sort(compareAttrRows)
  }
}

// Absent, unparsable, or undecodable values are left untouched (their readers
// already discard them); a value that converts to identical bytes skips the
// write. Returns false only when a needed write failed.
const rewriteArenaSlot = (): boolean => {
  const raw = readStorage(ARENA_KEY)
  if (raw === null) return true
  const state = decodeGridStateFromUrl(raw)
  if (!state) return true
  const encoded = encodeGridStateToUrl(state)
  return encoded === raw || writeStorage(ARENA_KEY, encoded)
}

const rewriteModeSlot = (mode: string): boolean => {
  const key = `stargazer.teams.active.${mode}`
  const raw = readStorage(key)
  if (raw === null) return true
  let slot: Record<string, unknown>
  try {
    slot = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return true
  }
  // Only the envelope's `data` converts; `v`/`sourceId`/`defaults` pass
  // through byte-identical, and staleness stays the loader's business.
  if (typeof slot !== 'object' || slot === null || slot.v !== 1 || typeof slot.data !== 'string') {
    return true
  }
  const decoded = decodeMultiGridStateFromUrl(slot.data)
  if (!decoded) return true
  const data = encodeMultiGridStateToUrl(decoded)
  if (data === slot.data) return true
  return writeStorage(key, JSON.stringify({ ...slot, data }))
}

const rewriteLibrary = (): boolean => {
  const raw = readStorage(LIBRARY_KEY)
  if (raw === null) return true
  let blob: { v?: unknown; teams?: unknown }
  try {
    blob = JSON.parse(raw) as { v?: unknown; teams?: unknown }
  } catch {
    return true
  }
  if (typeof blob !== 'object' || blob === null || blob.v !== 1 || !Array.isArray(blob.teams)) {
    return true
  }
  // Raw-preserving: a record that fails to canonicalize keeps its stored
  // bytes — this pass must never become the thing that persists a drop.
  let changed = false
  const teams = blob.teams.map((record) => {
    if (typeof record !== 'object' || record === null) return record
    const data = (record as Record<string, unknown>).data
    if (typeof data !== 'string') return record
    const canonical = canonicalTeamData(data)
    if (canonical === null || canonical === data) return record
    changed = true
    return { ...record, data: canonical }
  })
  if (!changed) return true
  return writeStorage(LIBRARY_KEY, JSON.stringify({ v: 1, teams }))
}

export function runUpgradeStoragePass(): void {
  if (readStorage(MARKER_KEY) !== null) return
  let allOk = rewriteArenaSlot()
  for (const mode of TEAM_MODE_KEYS) {
    allOk = rewriteModeSlot(mode) && allOk
  }
  allOk = rewriteLibrary() && allOk
  if (allOk) writeStorage(MARKER_KEY, '1')
}
