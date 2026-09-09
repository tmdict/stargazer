/* One-time conversion of stored/shared legacy data to the current formats: the
 * pre-`u` JSON `p` boards, and the entire pre-v2 (v1) binary link format —
 * every consumer outside this file knows only `u` rows and v2 links.
 *
 * Four pieces:
 * - `convertLegacyBoard` and `stampLegacySeason` run inside
 *   decodeMultiGridStateFromUrl — the single choke point for all multi-board
 *   JSON (library hydration, mode slots, import files, previews, side-load)
 *   — so any legacy `p` payload converts and any pre-season-field payload
 *   gains its `season: 7` stamp the moment it is read.
 * - `decodeLegacyLink` is the frozen v1 binary reader (verbatim copy of the
 *   retired decoder, bit-1 paragon section included, plus a strict
 *   full-consumption check the original lacked — without it the v1 reader
 *   "succeeds" on v2 bytes) with a JSON-multi fallback for pre-binary Teams
 *   links. Its ONLY caller is the universal link decoder in urlStateManager;
 *   nothing else may call it, which is what keeps the storage pass idempotent
 *   (the wrapper probes strict v2 first, so an already-converted value
 *   re-encodes to identical bytes and skips the write).
 * - `runUpgradeStoragePass` runs once at app startup and rewrites the at-rest
 *   keys (library records, the four mode slots, the arena autosave) so stored
 *   data stops depending on the read-side conversions before deletion.
 *
 * The pass is idempotent, so its marker is written LAST, only after every
 * attempted write landed — a failed write (quota; the library is the app's
 * largest key) just retries next load. (A non-idempotent pass would need the
 * opposite, marker-FIRST discipline; this one re-runs harmlessly, so retry
 * beats never-again.) Accepted races: two tabs both running the pass write
 * equivalent bytes; a stale pre-deploy tab autosaving legacy-format data
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
 *    tests legacy behavior.
 * 4. In src/utils/urlStateManager.ts: remove the convertLegacyBoard,
 *    stampLegacySeason, and decodeLegacyLink imports and their tagged
 *    TEMPORARY calls — in decodeMultiGridStateFromUrl delete the tagged
 *    stamp call and board loop; in decodeLinkFromUrl replace the tagged
 *    `return decodeLegacyLink(...)` line with `return null` (the function
 *    needs a terminal return). Also trim the two header sentences mentioning
 *    the shim (the file-header BINARY bullet and the decodeLinkFromUrl doc).
 * 4b. Remove the tagged TEMPORARY `season?` field from BinaryLinkState
 *    (src/utils/binaryEncoder.ts) and simplify the link path's
 *    `link.season ?? CURRENT_SEASON` (src/composables/useTeamsRestore.ts)
 *    to `CURRENT_SEASON`, trimming its legacy-JSON sentence.
 * 4c. In src/views/ShareView.vue: remove the tagged TEMPORARY
 *    stripRetiredSeasonal wrapper (and its import) around the multi restore —
 *    binary links carry no season, so post-shim it is a guaranteed no-op.
 * 5. In src/App.vue: remove the runUpgradeStoragePass import, its bare call
 *    in the setup block, and the ordering comment above it.
 * 6. Trim every shim mention from comments and docs — these say "shim" or
 *    "legacy", not "upgradeMigration", so step 8's grep can't find them:
 *    - docs/architecture/URL_SERIALIZATION.md: the Migration shim section,
 *      the season-field sentence, the universal decoder's "falls through to
 *      the temporary legacy shim" clause, and the all-or-nothing paragraph's
 *      "lets the legacy shim probe formats safely" clause.
 *    - docs/architecture/SEASONAL.md: the "stamped season 7 by the TEMPORARY
 *      shim" sentence in Season cutover & retirement.
 *    - docs/ARCHITECTURE.md: the utilities bullet's "the temporary
 *      upgradeMigration.ts shim ..." clause.
 *    - src/lib/seasonal.ts: the header's shim-window sentences (keep the
 *      unstamped-payload rule itself).
 *    - src/utils/seasonRotation.ts: "unlike the temporary migration shim".
 *    - src/utils/binaryEncoder.ts: the header's "which the shim's probe
 *      order relies on" clause and decodeLink's shim-window comment.
 *    - src/lib/characters/attributes.ts: "and legacy conversion" in the
 *      compareAttrRows comment.
 * 7. The stargazer.migration.u marker key stays behind in user storage as
 *    accepted residue.
 * 8. Verify: `grep -ri upgrademigration src tests docs` and
 *    `grep -rin shim src docs` both return nothing, then lint, type-check,
 *    and the test suite pass with no further edits.
 * Expected user-visible consequences, accepted by policy (old links and
 * exports are expendable): pre-release links of every kind stop decoding
 * (empty board), and pre-release data the storage pass never reached — export
 * files on disk, plus the slots/library of a device first seen after deletion
 * — loses its paragon levels and season provenance: seasonal ids resolve as
 * current-pool content instead of "S7" placeholders.
 *
 * The storage keys, the v1 bit reader, and the v1 field widths are all
 * duplicated here (not imported from or exported to their owners) so deleting
 * this file leaves no orphaned exports behind.
 */

import { clampAttr, compareAttrRows, type AttrRow } from '@/lib/characters/attributes'
import { resolveTeamMode } from '@/lib/teams/modes'
import { canonicalTeamData } from '@/lib/teams/savedTeam'
import { readStorage, writeStorage } from '@/utils/storage'
// Import cycle with urlStateManager (it calls back into this shim): safe
// because every cross-reference is call-time, but neither module may use the
// other's exports at module-init level while this file exists.
import {
  decodeGridStateFromUrl,
  decodeMultiGridStateFromUrl,
  encodeGridStateToUrl,
  encodeMultiGridStateToUrl,
} from '@/utils/urlStateManager'
import type { BinaryLinkState } from './binaryEncoder'
import {
  packDisplayFlags,
  unpackDisplayFlags,
  type GridState,
  type MultiGridState,
} from './gridStateSerializer'

const MARKER_KEY = 'stargazer.migration.u'
const ARENA_KEY = 'stargazer.arena'
const LIBRARY_KEY = 'stargazer.teams.saved'
const TEAM_MODE_KEYS = ['1v1', '3v3', '5v5', '5v5sl'] as const

/* Stamp a pre-field payload with the season its content pool can only be:
 * everything serialized before the season field existed was built from the
 * season-7 pool. Runs inside the JSON decode choke point beside
 * convertLegacyBoard; the at-rest storage pass persists the stamp. After
 * deletion an unstamped payload (an old export file, hand-crafted data)
 * simply has no provenance — its seasonal ids resolve as current-pool
 * content, the accepted expendable-data outcome. */
export function stampLegacySeason(state: MultiGridState): void {
  if (state.season === undefined) state.season = 7
}

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
    if ((team !== 1 && team !== 2) || !Number.isInteger(characterId) || characterId < 1) continue
    if (!Number.isFinite(level)) continue
    const value = clampAttr(1, level)
    // Last-wins includes a trailing default: the old format's sequential
    // setParagon ended wherever the final entry landed, zero included.
    if (value > 0) byHero.set(`${team}:${characterId}`, [team, characterId, 1, value])
    else byHero.delete(`${team}:${characterId}`)
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
  // The pass runs in root setup before the marker exists, so an unforeseen
  // throw would repeat on every load and block startup; swallowing it instead
  // degrades to the same retry-next-load the marker-last discipline gives
  // failed writes.
  try {
    let allOk = rewriteArenaSlot()
    for (const mode of TEAM_MODE_KEYS) {
      allOk = rewriteModeSlot(mode) && allOk
    }
    allOk = rewriteLibrary() && allOk
    if (allOk) writeStorage(MARKER_KEY, '1')
  } catch (err) {
    console.error('Upgrade storage pass failed, will retry next load:', err)
  }
}

/* ------------------------------------------------------------------------- *
 * Frozen v1 binary reader — the retired link format, decode-only.
 * ------------------------------------------------------------------------- */

const V1_HEX_ID_BITS = 6
const V1_TILE_STATE_BITS = 3
const V1_TEAM_BITS = 1
const V1_CHARACTER_ID_BITS = 16
const V1_ARTIFACT_BITS = 6
const V1_PHANTIMAL_ID_BITS = 4
const V1_PHANTIMAL_COUNT_BITS = 4
const V1_SYNERGY_COUNT_BITS = 4
const V1_PARAGON_LEVEL_BITS = 3
const V1_PARAGON_COUNT_BITS = 5

class V1BitReader {
  private position = 0

  constructor(private bytes: Uint8Array) {}

  readBits(bitCount: number): number {
    let value = 0
    for (let i = 0; i < bitCount; i++) {
      const byteIndex = Math.floor((this.position + i) / 8)
      const bitIndex = (this.position + i) % 8
      if (byteIndex >= this.bytes.length) {
        throw new Error('Unexpected end of data')
      }
      const byte = this.bytes[byteIndex]
      if (byte === undefined) {
        throw new Error('Unexpected end of data')
      }
      value |= ((byte >> bitIndex) & 1) << i
    }
    this.position += bitCount
    return value
  }

  atCleanEnd(): boolean {
    const remaining = this.bytes.length * 8 - this.position
    if (remaining < 0 || remaining >= 8) return false
    return remaining === 0 || this.readBits(remaining) === 0
  }
}

/* The retired v1 decoder, verbatim (packed two-counts header byte, extended
 * header/counts, display-flags presence bit, the bit-1 paragon section merged
 * into `u` rows) plus the strict trailing check: without full consumption the
 * v1 reader "decodes" v2 bytes into a plausible wrong state, and the storage
 * pass's retry would then overwrite converted data with garbage. */
const decodeV1Binary = (bytes: Uint8Array): GridState | null => {
  if (bytes.length === 0) return {}
  if (bytes.length === 1 && bytes[0] === 0) return {}

  try {
    const reader = new V1BitReader(bytes)
    const state: GridState = {}

    const header = reader.readBits(8)
    let tileCount = header & 0x07
    let charCount = (header >> 3) & 0x07
    const hasArtifacts = (header & 0x40) !== 0
    const hasExtended = (header & 0x80) !== 0

    let hasPhantimals = false
    let hasLegacyParagon = false
    let hasSynergy = false

    if (hasExtended) {
      const extendedFlags = reader.readBits(8)
      const needsExtendedCounts = (extendedFlags & 0x01) !== 0
      hasPhantimals = (extendedFlags & 0x40) !== 0
      hasLegacyParagon = (extendedFlags & 0x02) !== 0
      hasSynergy = (extendedFlags & 0x04) !== 0

      if ((extendedFlags & 0x80) !== 0) {
        state.d = reader.readBits(8)
      }
      if (needsExtendedCounts) {
        tileCount += reader.readBits(8)
        charCount += reader.readBits(8)
      }
    }

    if (tileCount > 0) {
      state.t = []
      for (let i = 0; i < tileCount; i++) {
        state.t.push([reader.readBits(V1_HEX_ID_BITS), reader.readBits(V1_TILE_STATE_BITS)])
      }
    }

    if (charCount > 0) {
      state.c = []
      for (let i = 0; i < charCount; i++) {
        state.c.push([
          reader.readBits(V1_HEX_ID_BITS),
          reader.readBits(V1_CHARACTER_ID_BITS),
          reader.readBits(V1_TEAM_BITS) + 1,
        ])
      }
    }

    if (hasArtifacts) {
      const ally = reader.readBits(V1_ARTIFACT_BITS)
      const enemy = reader.readBits(V1_ARTIFACT_BITS)
      state.a = [ally === 0 ? null : ally, enemy === 0 ? null : enemy]
    }

    if (hasPhantimals) {
      const count = reader.readBits(V1_PHANTIMAL_COUNT_BITS)
      if (count > 0) {
        state.s = []
        for (let i = 0; i < count; i++) {
          state.s.push([
            reader.readBits(V1_HEX_ID_BITS),
            reader.readBits(V1_PHANTIMAL_ID_BITS),
            reader.readBits(V1_TEAM_BITS) + 1,
          ])
        }
      }
    }

    const paragonRows: AttrRow[] = []
    if (hasLegacyParagon) {
      const count = reader.readBits(V1_PARAGON_COUNT_BITS)
      for (let i = 0; i < count; i++) {
        const teamBit = reader.readBits(V1_TEAM_BITS)
        const charId = reader.readBits(V1_CHARACTER_ID_BITS)
        const level = reader.readBits(V1_PARAGON_LEVEL_BITS)
        paragonRows.push([teamBit + 1, charId, 1, level])
      }
    }

    if (hasSynergy) {
      const count = reader.readBits(V1_SYNERGY_COUNT_BITS)
      if (count > 0) {
        state.y = []
        for (let i = 0; i < count; i++) {
          state.y.push([
            reader.readBits(V1_HEX_ID_BITS),
            reader.readBits(V1_CHARACTER_ID_BITS),
            reader.readBits(V1_TEAM_BITS) + 1,
          ])
        }
      }
    }

    if (paragonRows.length > 0) {
      state.u = paragonRows.sort(compareAttrRows)
    }

    if (!reader.atCleanEnd()) return null
    return state
  } catch {
    return null
  }
}

// v1 states without a flags byte predate display flags; the v2 envelope's
// byte is mandatory, so they take the unpack defaults (skills/perspective on).
const legacyFlagsByte = (d: number | undefined): number =>
  (d ?? packDisplayFlags(unpackDisplayFlags(undefined))) & 0xff

/* Read one legacy link payload into the v2 link shape. JSON probe first — a
 * pre-binary Teams link parses deterministically, while binary bytes
 * essentially never parse as JSON with a boards array — then the frozen v1
 * binary reader (arena links and the stored arena autosave). */
export function decodeLegacyLink(encoded: string, bytes: Uint8Array): BinaryLinkState | null {
  const multi = decodeMultiGridStateFromUrl(encoded)
  if (multi && multi.boards.length > 0) {
    return {
      mode: resolveTeamMode(multi),
      active: Math.min(Math.max(multi.active ?? 0, 0), multi.boards.length - 1),
      d: legacyFlagsByte(multi.d),
      boards: multi.boards,
      // Provenance rides through to the ingress strip: once the current
      // season moves past the stamp, this link's seasonal ids must not load
      // as the new season's content.
      season: multi.season,
    }
  }

  const state = decodeV1Binary(bytes)
  if (!state) return null
  const { d, ...board } = state
  return { mode: 'arena', active: 0, d: legacyFlagsByte(d), boards: [board] }
}
