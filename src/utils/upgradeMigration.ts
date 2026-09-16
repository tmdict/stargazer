/* One-time conversion of stored/shared legacy data to the current formats: the
 * pre-`u` JSON `p` boards, and the entire pre-v2 (v1) binary link format —
 * every consumer outside this file knows only `u` rows and v2 links.
 *
 * Three pieces:
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
 * - The 5v5sl retirement. Supreme League is a type of 5v5 derived from the
 *   boards' maps, so the retired mode key and wire id 4 have no reader left.
 *   `decodeLegacyLink` re-reads a link carrying id 4 as 5v5 (its boards
 *   already carry the SL maps), `validateSavedTeam` maps a record's `mode` in
 *   one tagged line (import files, the pre-deploy-tab race), and
 *   `runModeStoragePass` moves the retired slot into the 5v5 slot when it was
 *   the last-used mode, rewrites library records, and drops the retired key.
 *   It runs under its own marker: the u marker is already set on every device
 *   that ran the first pass. The two passes are order-independent in outcome
 *   (a missing key reads as done; a moved payload still saying 5v5sl heals at
 *   ingress via normalizeTeamPayload); App.vue runs the u-pass first so a
 *   device that skipped a release converts the retired slot's rows before the
 *   move. Its decision is recorded in a flag BEFORE the large copy: after a
 *   failed attempt, normal startup rejects the retired key, falls back to 5v5
 *   and persists it, so a retry alone could not tell that SL was last used.
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
 *    tests legacy behavior. Two test comments name the shim and need
 *    trimming: the CURRENT_SEASON pin in tests/unit/lib/seasonal.test.ts and
 *    the season-sanitize case in tests/unit/utils/urlStateManager.test.ts.
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
 * 4d. In src/lib/teams/savedTeam.ts: delete the tagged TEMPORARY line in
 *    validateSavedTeam and fold `mode` back into the destructuring above it.
 * 4e. In src/lib/teams/wire.ts: delete the TEMPORARY comment naming id 4
 *    inside WIRE_MODES; the id is then simply the next free one.
 * 5. In src/App.vue: remove the runUpgradeStoragePass and runModeStoragePass
 *    imports, their bare calls in the setup block, and the ordering comment
 *    above them; drop the "Permanent:" prefix from the season-rotation
 *    comment that follows, which only contrasts with the removed block.
 * 6. Trim every shim mention from comments and docs — these say "shim" or
 *    "legacy", not "upgradeMigration", so step 8's grep can't find them:
 *    - docs/architecture/URL_SERIALIZATION.md: the Migration shim section
 *      (including its wire-id-4 sentence), the season-field sentence, the
 *      universal decoder's "falls through to the temporary legacy shim"
 *      clause, the all-or-nothing paragraph's "lets the legacy shim probe
 *      formats safely" clause, the wire registry's "converted by the shim
 *      while it exists" sentence about id 4, and the growth table's "(id 4
 *      once the shim is gone)" parenthetical in the Mode id row.
 *    - docs/architecture/TEAMS.md: the sentence in Per-Mode Persistence about
 *      the retired 5v5sl slot and the TEMPORARY mode pass.
 *    - docs/architecture/SEASONAL.md: the "stamped season 7 by the TEMPORARY
 *      shim" sentence in Season cutover & retirement.
 *    - docs/ARCHITECTURE.md: the utilities bullet's "the temporary
 *      upgradeMigration.ts shim ..." clause.
 *    - src/lib/seasonal.ts: the header's shim-window sentences (keep the
 *      unstamped-payload rule itself).
 *    - src/utils/seasonRotation.ts: "unlike the temporary migration shim"
 *      (header) and "Marker-last, like the storage pass" (inside
 *      runSeasonRotationPass).
 *    - src/utils/binaryEncoder.ts: the header's "which the shim's probe
 *      order relies on" clause and decodeLink's shim-window comment.
 *    - src/lib/characters/attributes.ts: "and legacy conversion" in the
 *      compareAttrRows comment.
 * 7. The stargazer.migration.u and stargazer.migration.sl marker keys stay
 *    behind in user storage as accepted residue, as do a
 *    stargazer.migration.sl.move flag on a device whose slot copy never
 *    succeeded, a stargazer.teams.active.5v5sl slot on a device the mode
 *    pass never reached, and a `defaults` field inside slot envelopes the
 *    page never rewrote (ignored on load, dropped by the next write).
 * 8. Verify: `grep -ri upgrademigration src tests docs` and
 *    `grep -rin shim src docs` both return nothing, then lint, type-check,
 *    and the test suite pass with no further edits.
 * Expected user-visible consequences, accepted by policy (old links and
 * exports are expendable): pre-release links of every kind stop decoding
 * (empty board), links carrying wire id 4 fall back to the saved slot (and
 * once a new board count takes id 4, reject as a wrong-shape link), export
 * files whose records still say 5v5sl drop those records at import, and
 * pre-release data the storage pass never reached (export files on disk,
 * plus the slots/library of a device first seen after deletion) loses its
 * paragon levels and season provenance: seasonal ids resolve as current-pool
 * content instead of "S7" placeholders.
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
import { decodeLink, type BinaryLinkState } from './binaryEncoder'
import {
  packDisplayFlags,
  unpackDisplayFlags,
  type GridState,
  type MultiGridState,
} from './gridStateSerializer'

const MARKER_KEY = 'stargazer.migration.u'
const ARENA_KEY = 'stargazer.arena'
const LIBRARY_KEY = 'stargazer.teams.saved'
// The retired 5v5sl slot stays in this list so its rows convert before the
// mode pass moves it.
const TEAM_MODE_KEYS = ['1v1', '3v3', '5v5', '5v5sl'] as const

const MODE_MARKER_KEY = 'stargazer.migration.sl'
const MODE_MOVE_KEY = 'stargazer.migration.sl.move'
const TEAMS_MODE_KEY = 'stargazer.teams.mode'
const RETIRED_SLOT_KEY = 'stargazer.teams.active.5v5sl'
const FIVE_V_FIVE_SLOT_KEY = 'stargazer.teams.active.5v5'
const RETIRED_MODE = '5v5sl'
const FIVE_V_FIVE_MODE = '5v5'
// Wire ids duplicated from lib/teams/wire.ts, like every other constant here.
const RETIRED_WIRE_ID = 4
const FIVE_V_FIVE_WIRE_ID = 3

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
  // Only the envelope's `data` converts; every other key passes through
  // byte-identical, and staleness stays the loader's business.
  if (typeof slot !== 'object' || slot === null || slot.v !== 1 || typeof slot.data !== 'string') {
    return true
  }
  const decoded = decodeMultiGridStateFromUrl(slot.data)
  if (!decoded) return true
  const data = encodeMultiGridStateToUrl(decoded)
  if (data === slot.data) return true
  return writeStorage(key, JSON.stringify({ ...slot, data }))
}

// The stored library's records, or null when the key is absent, unparsable,
// or not a v1 blob (its reader already discards those).
const readLibraryTeams = (): unknown[] | null => {
  const raw = readStorage(LIBRARY_KEY)
  if (raw === null) return null
  let blob: { v?: unknown; teams?: unknown }
  try {
    blob = JSON.parse(raw) as { v?: unknown; teams?: unknown }
  } catch {
    return null
  }
  if (typeof blob !== 'object' || blob === null || blob.v !== 1 || !Array.isArray(blob.teams)) {
    return null
  }
  return blob.teams
}

const rewriteLibrary = (): boolean => {
  const records = readLibraryTeams()
  if (records === null) return true
  // Raw-preserving: a record that fails to canonicalize keeps its stored
  // bytes — this pass must never become the thing that persists a drop.
  let changed = false
  const teams = records.map((record) => {
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
 * The 5v5sl retirement: storage pass.
 * ------------------------------------------------------------------------- */

// Inlined rather than added to utils/storage.ts: nothing permanent needs a
// remove, and this module must leave no orphaned exports behind.
const removeStorage = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch {
    // Best effort, like every other storage call.
  }
}

/* Move or drop the retired slot. Last-used wins: when 5v5sl was the last-used
 * mode its boards become the 5v5 slot; otherwise they are dropped. The
 * decision is flagged before the large copy so a retry after a failed write
 * still moves even though startup has since persisted 5v5 as last-used. Write
 * order: flag, copy, delete old, rewrite last-used, clear flag; a failed write
 * returns false before the delete, so nothing is ever half-moved. */
const rewriteRetiredSlot = (): boolean => {
  const lastUsed = readStorage(TEAMS_MODE_KEY)
  const slot = readStorage(RETIRED_SLOT_KEY)
  let move = readStorage(MODE_MOVE_KEY) !== null
  if (lastUsed === RETIRED_MODE) {
    if (!writeStorage(MODE_MOVE_KEY, '1')) return false
    move = true
  }
  if (slot !== null) {
    if (move && !writeStorage(FIVE_V_FIVE_SLOT_KEY, slot)) return false
    removeStorage(RETIRED_SLOT_KEY)
  }
  if (lastUsed === RETIRED_MODE && !writeStorage(TEAMS_MODE_KEY, FIVE_V_FIVE_MODE)) return false
  removeStorage(MODE_MOVE_KEY)
  return true
}

// Only the record's own `mode` field converts; its data payload already
// resolves to 5v5 through resolveTeamMode at every read.
const rewriteLibraryModes = (): boolean => {
  const records = readLibraryTeams()
  if (records === null) return true
  let changed = false
  const teams = records.map((record) => {
    if (typeof record !== 'object' || record === null) return record
    if ((record as Record<string, unknown>).mode !== RETIRED_MODE) return record
    changed = true
    return { ...record, mode: FIVE_V_FIVE_MODE }
  })
  if (!changed) return true
  return writeStorage(LIBRARY_KEY, JSON.stringify({ v: 1, teams }))
}

export function runModeStoragePass(): void {
  if (readStorage(MODE_MARKER_KEY) !== null) return
  try {
    let allOk = rewriteRetiredSlot()
    allOk = rewriteLibraryModes() && allOk
    if (allOk) writeStorage(MODE_MARKER_KEY, '1')
  } catch (err) {
    console.error('Mode storage pass failed, will retry next load:', err)
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
  // Wire id 4 is the retired 5v5sl mode's id. Its boards already carry the
  // SL maps, so re-reading the bytes as mode 3 (5v5) is the whole conversion.
  // Patched on a copy: the v1 reader below must see the original bytes (a v1
  // header whose tile count is 4 mod 8 shares these low bits), and the JSON
  // probe is untouched by construction (every payload starts with `{`).
  if (((bytes[0] ?? 0) & 0b111) === RETIRED_WIRE_ID) {
    const patched = bytes.slice()
    patched[0] = ((patched[0] ?? 0) & ~0b111) | FIVE_V_FIVE_WIRE_ID
    const link = decodeLink(patched)
    if (link) return link
  }

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
