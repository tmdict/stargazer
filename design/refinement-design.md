# EX Refinement Levels — Revised Design & Execution Plan

Design only — no implementation yet. Supersedes the original `design-refinements.md`
handoff. Audited across two review rounds (round 1: senior engineer + architect;
round 2: staff engineer + architect); all findings are folded in and summarized
in §7, with decision attribution — owner-decided vs open vs recommended — in
§8. Serialization is the owner-chosen generic `u` key (extensibility
non-negotiable); the migration shim is TEMPORARY per owner policy (CLAUDE.md);
the dock is per-board. All decisions are settled — implementation-ready.

Every code reference below has been verified against the current codebase.

---

## 1. Goal

Capture each hero's **EX refinement level (r0–r4)** alongside the existing **paragon
level (p0–p4)**, on both the ally and enemy teams, with:

- corner badges on hero portraits (display-only),
- a floating control bar under each board that owns all editing,
- shareable links that round-trip both values,
- a format that extends to future per-hero or per-team upgrades without another
  migration.

Opponent refinement is visible and editable. Exact stat values conferred by
refinement are out of scope — only the level is tracked.

## 2. Data model — generic hero attributes

### Registry

New append-only registry, `src/lib/characters/attributes.ts`:

| attrId | name       | range | default |
| ------ | ---------- | ----- | ------- |
| 1      | paragon    | 0–4   | 0       |
| 2      | refinement | 0–4   | 0       |

Rules:

- **Append-only.** Ids are never reused or renumbered; retired attrs stay reserved.
- Ids are named exports (`ATTR_PARAGON = 1`, `ATTR_REFINEMENT = 2`).
- Each entry declares its range and default; the serializer emits only non-default
  values (sparse).
- **Clamp lives in exactly two places**: the state layer (`setAttr`, generalizing
  today's `setParagon` clamp at `useGridContext.ts:201`) for the JSON multi-board
  path, and `validateGridState` for the binary codec. `canonicalTeamData` never
  clamps — no third clamp site.
- **Unknown attrIds are dropped everywhere** — restore ignores them (never
  stored, never thrown), the binary codec drops them (the wire-attrId pin
  below), and `canonicalTeamData` drops them like any other unregistered
  content. There is no version-skew scenario to preserve them for: the app is a
  single hosted deployment (owner: "once it updates there won't be old versions
  available anywhere else"), so an unknown attrId can only come from a crafted
  or corrupt payload. Pinned by a decode fixture.
- A contract test pins the registry (ids, ranges, defaults) alongside the existing
  `BOARD_CONTENT_KEYS` contract test.
- `PARAGON_MAX_LEVEL` (`src/lib/characters/paragon.ts:9`) becomes the registry's
  paragon range; the team-power math in that file is untouched.

### In-memory / JSON serialization — the `u` key

`GridState` (`src/utils/gridStateSerializer.ts:9`) replaces `p` with `u`
("upgrades"), holding uniform rows:

```
u: [team, characterId, attrId, value][]
```

- `team`: 1 = ally, 2 = enemy (existing encoding).
- `characterId`: hero id. **0 is reserved** as a team-scope sentinel —
  verified free: real hero ids start at 1 (smallest id in
  `src/data/character/*.json` is 1), placeholders occupy 9001–9007
  (`placeholder.ts:21,34-42`), companions sit at ≥10000, and the binary codec's
  validation requires `charId > 0` everywhere today (`binaryEncoder.ts:124-131,
  218-229`), so nothing has ever emitted a 0. The row shape and the attrs-map
  key (`${team}:0`) carry it as-is, and the new generic binary section's
  validation **permits characterId 0** from day one so the wire needs no change
  later. What a team-level attr still needs when one ships: the serializer
  switches from the per-tile walk (`gridStateSerializer.ts:95-108`) to
  whole-record enumeration, and consumers (`sideLoad`, restore) route id-0 rows
  to team scope — known, bounded work, not a format change.
- Rows are emitted **sorted by (team, characterId, attrId)**; only non-default
  values appear. The comparator is a **registry export** (it must survive the
  shim's deletion — serializer, canonicalization, and shim all import it).
  Canonicalization (`canonicalTeamData`) also sorts `u` rows — required so a
  converted legacy record and a fresh snapshot of the same board are byte-equal
  (the unsaved-changes compare and import dedupe at `transfer.ts:23` are byte
  compares).

`BOARD_CONTENT_KEYS` (`gridStateSerializer.ts:152`) changes from
`['t','c','s','y','p','a','m']` to `['t','c','s','y','u','a','m']`.

### Two wire formats — verified split

- **Multi-board (Teams page, saved teams, import files, `/teams?g=`)** is url-safe
  base64 **JSON** (`urlStateManager.ts:33`). Here `u` is a literal JSON key and
  legacy `p` needs the temporary shim (below).
- **Single-board Arena (`?g=`, `stargazer.arena` autosave)** is the **binary
  codec** (`src/utils/binaryEncoder.ts`; spec at `:26-80`, bits 3–5 verified
  free). **All upgrades — paragon included — ride one generic upgrades section
  behind bit 3** (owner decision: no legacy wire shapes are kept; the old
  bit-1 paragon section is retired, not preserved): count (6 bits), then per
  entry team (1) + characterId (16, **0 permitted** for the team-scope
  sentinel) + attrId (6) + value (4) = 27 bits, carrying every wire-pinned
  attrId. **Appended after the synergy section** — currently last
  (`binaryEncoder.ts:440-448`). The encoder never writes the bit-1 paragon
  section again, and its constants (`PARAGON_LEVEL_BITS`, `PARAGON_COUNT_BITS`,
  `binaryEncoder.ts:15-18`) die with it; **bit 1 is freed for future reuse
  once the shim is deleted** (not permanently retired — reserving it would
  only protect how expendable ancient links fail; if reused, such a link
  decodes as garbage instead of failing cleanly, accepted). Until deletion the
  shim's decode branch owns the bit. Post-shim free bits: 1, 4, 5. One code
  path for every attr — no attrId-1 special routing.
  A **TEMPORARY decode branch** keeps reading a bit-1 paragon section into
  attrId-1 `u` rows during the shim window (it lives inline in the decoder's
  sequential bit-read flow, tagged and enumerated in the upgradeMigration
  removal runbook — bit-parsing can't be extracted to the shim module). The
  arena autosave self-heals immediately: `useArenaPersistence` rewrites
  `stargazer.arena` up front on first load (`useGridPersistence.ts:81`), in
  the new section. After shim removal, an old Arena link carrying paragon
  fails to decode (bit 1 unknown → the sequential read desyncs → decode
  returns null → the link loads an empty board) — accepted per the owner's
  "I don't care about links breaking". The codec's contract test pins the
  wire-carried attrIds and that registry ranges fit the 4-bit value field.
  Capacity: real heroes cap at 5 per team (`character.ts:97-98`; skill-driven
  bumps admit only companions, excluded by `isBaseHeroId`), so 10 rows per
  attr per board — the 6-bit count (63) holds six wire attrs.

### Legacy `p` shim — TEMPORARY, deleted ~1 month after release

**(Owner decision, final: shims are always temporary in this project — permanent
conversion/translation fallbacks are out of policy (CLAUDE.md), and old share
links / old export files are explicitly expendable once the shim is removed.)**

All legacy knowledge lives in one deletable module,
`src/utils/upgradeMigration.ts`, mirroring `gridInfoMigration.ts`'s shape
(TEMPORARY header, accepted-races note, step-by-step removal runbook). Two
halves — both needed for the month, both die together (the decode half alone
leaves at-rest data unconverted at the deadline; the storage half alone can't
serve external ingress):

**1. Decode-side conversion**, invoked from `decodeMultiGridStateFromUrl`
(`urlStateManager.ts:37`) — the verified single choke point for all multi-board
JSON: library hydration, per-mode autosave slots, `/teams?g=` links, import
files, previews, side-load, Teams ingress normalization
(`useTeamsRestore.ts:78,145`), and ShareView's format probe (`ShareView.vue:39`).
Per board:

- If `p` is present and `u` absent: convert each valid row
  `[team, characterId, level]` → `[team, characterId, ATTR_PARAGON, level]`,
  sorted with the registry comparator.
- **Row filter, pinned**: keep only length-3, all-finite-number rows; clamp the
  level through the registry; dedupe duplicate `(team, characterId)` last-wins.
  (Today's decode passes `p` arrays through untouched and consumers guard
  per-entry; the Teams ingress *re-encodes* decoded payloads
  (`useTeamsRestore.ts:79`), so a sloppy conversion would persist `null`s into
  slots and canonical data.)
- `p` is **always deleted**, including when `u` already exists (conversion
  skipped, `p` dropped) — re-encoded payloads must never carry a stale `p`
  forward.

**2. A one-time storage pass**, invoked once from `App.vue` setup (SSR-guarded),
before any view's persistence reads — parent setup runs before route children
mount, and it runs for Arena-only visitors too, so on-device Teams data converts
even on a device that never opens `/teams` during the month. Per key, **pure
reuse of existing choke points**:

- The four `stargazer.teams.active.<mode>` slots (mode registry at
  `lib/teams/modes.ts:30` enumerates the keys): `JSON.parse` → require `v === 1`
  and string `data` (the `ActiveSlot` envelope, `useGridPersistence.ts:59-66`) →
  run `data` through `decodeMultiGridStateFromUrl` (conversion fires inside) →
  `encodeMultiGridStateToUrl` → write `{...slot, data}` with `v`, `sourceId`,
  `defaults` **byte-preserved**. Slots are NOT canonicalized (that would strip
  `active`/`d`/`mode`), the defaults-fingerprint check is NOT applied (staleness
  is load's business), and any slot that fails parse/decode is left untouched
  (load discards it anyway — today's behavior).
- The `stargazer.teams.saved` library: per record, `canonicalTeamData(data)`
  (decode-shim + canonical re-encode + sorted `u` in `BOARD_CONTENT_KEYS`
  order); **raw-preserving** — records where canonicalization returns null, and
  corrupt/unknown-version blobs, are left untouched (hydration today never
  writes back, `teamLibrary.ts:35-65`; the pass must not become the thing that
  persists silent record drops). `stargazer.teams.saved.backup` is a
  forward-version guard written on unknown `blob.v` only (`teamLibrary.ts:45-50`)
  and is not touched.
- `stargazer.arena`: decode through the binary codec (the temporary bit-1
  branch converts a legacy paragon section) and re-encode, so the arena slot
  is in the new section even on a device that never opens the Arena page
  during the month; an undecodable value is left untouched.

**Marker: dedicated key `stargazer.migration.u`, written LAST** — only after
every attempted `writeStorage` returned true; any failure leaves the marker
absent for a clean retry next load. This deliberately inverts
`gridInfoMigration`'s marker-first discipline: that remap is non-idempotent
(a repeat scrambles bytes), so its marker must land first; this conversion is
idempotent (`p`+no-`u` converts, anything else no-ops), so the risk inverts —
marker-first would turn one transient quota failure (the library blob is the
app's largest key; `storage.ts` fails silently) into permanent paragon loss at
the deadline. (The gridInfoMigration marker — absence of `stargazer.prefs` —
is also unavailable: it's consumed on every device that has run the app since
that shim shipped.) Accepted races, documented in the module header: two tabs
both running the pass (idempotent, equivalent writes); a stale pre-deploy tab
still open across the release writing `p`-form autosaves concurrently — the
one transient skew the hosted single-deployment model allows (healed by the
decode half until removal, an accepted loss after).

**Import files convert while the shim is live** — verified: `parseImport` runs
every record through `validateSavedTeam` → `canonicalTeamData` → the decode
choke point (`transfer.ts:73`), and dedupe compares the converted canonical
bytes (`transfer.ts:23,78-82`), so an old export imports with paragon intact
and true duplicates are skipped correctly. Only after removal does an old
export degrade (see accepted consequences).

**Removal runbook must enumerate**: the module; its test file; **the temporary
bit-1 paragon decode branch and its constants in `binaryEncoder.ts`**; the
grep-able
`describe('upgradeMigration …')` legacy blocks in shared test files (legacy-`p`
cases in `urlStateManager.test.ts` / `savedTeam.test.ts` live in such blocks so
removal is a grep, not an archaeology dig); the decode call + import in
`urlStateManager.ts`; the `App.vue` call + import + ordering comment; the
orphaned `stargazer.migration.u` key (accepted residue, noted like
`gridInfoMigration.ts:42-44` notes its key duplication); trimming shim mentions
from `URL_SERIALIZATION.md`/`TEAMS.md`; verification
(`grep -ri upgrademigration src tests` empty, then lint/type-check/tests).

**Accepted consequences, explicit and final**: after removal, old multi-board
links and old export files silently lose their paragon levels (canonicalization
drops the unregistered `p`; board content unaffected), and importing an old
export whose team already exists in `u` form lands as a paragon-less
"(imported)" duplicate (byte-compare dedupe no longer matches). Old Arena
links that carried paragon fail to decode entirely and load an empty board
(the retired bit-1 section desyncs the read); paragon-less old Arena links
keep working.

### Future expansion

Adding an attrId is **not** "one registry line and done"; in this codebase's
style (compare the `BOARD_CONTENT_KEYS` comment), a new per-hero attr touches:
registry row · state map (free) · transfers (free via whole-record take/set) ·
serializer emission (free) · binary wire (free — add the attrId to the wire pin
and it rides the generic bit-3 section) · grid-info pref key + parent +
`GridInfoView` / `GRID_INFO_NONE` fields · badge placement and palette · a dock
selector chip · locale strings. The storage, state, and wire layers are
generic; the user-facing surface is deliberately per-attr.

## 3. State

The per-board paragon map (`useGridContext.ts:196`, keyed `${team}:${characterId}`
→ level) generalizes to an **attrs map**: same key → `{ [attrId]: value }`, with
records deleted when all values are default (preserving today's "empty map when
clean" behavior, including "attrs survive removal but aren't serialized for
unplaced heroes", `useGridContext.ts:189-195`).

`GridContext` API (interface at `useGridContext.ts:152-155`): `getAttr(team, id,
attrId)` / `setAttr(team, id, attrId, value)` / `takeAttrs(team, id)` /
`setAttrs(team, id, record)`. `setAttrs` **replaces** the record (never merges) —
side-load stamps full records including defaults so a stale level can't linger
(`sideLoad.ts:29-31`); merge semantics would silently break that rule. The
per-attr `getParagon`/`setParagon` wrappers are dropped (keeping them would
reintroduce the dual code path this design removes) — which pulls
`TeamPowerPanel.vue` into slice 1 for a mechanical, script-only call-site
migration (see §5).

Verified transfer/consumer surface (each becomes a one-line record take/set):

| Site                                 | Location                        |
| ------------------------------------ | ------------------------------- |
| In-board move                        | `useGridContext.ts:296`         |
| In-board swap                        | `useGridContext.ts:314-317`     |
| Cross-board move                     | `stores/grids.ts:295`           |
| Cross-board swap                     | `stores/grids.ts:328-331`       |
| Board-swap collect / restore         | `stores/grids.ts:344-359, 404, 409` (the `collectMainUnits` record type changes too) |
| Side-load executor stamping          | `stores/grids.ts:521`           |
| Full clears (`switchMap`, `clearCharacters`) | `useGridContext.ts:394, 400` (`clearParagon` → `clearAttrs`) |
| Team clear (prefix wipe, unchanged)  | `useGridContext.ts:409-410`     |
| URL restore                          | `stores/urlState.ts:145-154`    |
| Panel display + tap editing          | `TeamPowerPanel.vue:50, 82, 89, 101, 107` |

Serializer callers that pass `getParagon` today and switch to the attrs getter:
`useGridPersistence.ts:97,134`, `views/HomeView.vue:253`,
`gridStateSerializer.ts:34,170`.

`sideLoad.ts` reads `board.u` (`sideLoad.ts:96`), carrying a per-hero attrs record
on `SideLoadUnit`; the executor stamps the full record. `lib/teams/preview.ts`
needs no change (reads unit sections only).

## 4. UI

### Split pill (display-only) — supersedes the corner badges

Corner badges collided between neighboring heroes on 5v5 boards, so both
layers render in a **single slanted split pill seated on the portrait's
bottom edge** (`.upill` in `TeamPowerPanel.vue`): `inline-flex`,
`border-radius: 999px`, **1.5px white border**, `margin-top: -7px`, the
armed ring an `outline` outside the border. `font-size: 7.5px` base,
bumped to 9px at the ≥480px container tier.

- **P half left, R half right**, halves split by a 112° slanted seam built
  in one `linear-gradient`; a **white sliver at the seam stays visible at
  every level combination** so an all-gray pill still reads as two halves.
- Palette:
  - P0–P3, R0–R1: neutral gray — bg `#cfc8bb`, text `#4a463d`. The per-tier
    `--color-tier-1..3` fills are retired from the panel (the variables stay
    for other consumers).
  - **R2–R3: light red tint `#f5cdc2`, dark text** — mid refinement shows as
    visible progress without stealing the maxed pop.
  - **P4: silver-blue `#8fa7c8`, white text.** **R4: `#e4938a`, white
    text** (a lightened relative of the old P3 fill).
  - White-on-`#8fa7c8` is below strict WCAG contrast; accepted because the
    pill is bold, tiny, and the fill alone signals "maxed".
- **Single visible layer**: the pill collapses to a one-color chip;
  `.useg:only-child` raises its min-width (30px / 36px at the large tier)
  so it keeps pill proportions instead of shrinking to a near-circle.
- Refinement badge visibility: add `refinement` to `GridInfoPrefs` /
  `GridInfoView` / `DEFAULTS` (default `false`) / `GRID_INFO_NONE`
  (`useGridInfoPrefs.ts:27-91`) and `GRID_INFO_PARENTS: { refinement:
  ['heroCard'] }`. Old stored pref objects merge over defaults (`sliceFrom`),
  so no pref migration.
- Attrs attach only to real heroes (`isRealHeroId`, `TeamPowerPanel.vue:40-42`).
- ShareView: badges render, **no dock** (readonly — the asymmetry is
  intentional). Visibility follows the *viewer's* device prefs
  (`ShareView.vue:74-75`), exact parity with paragon today: with `heroCard` and
  `refinement` defaulting off, recipients see badges only after enabling them in
  the share view's grid-info toggle. Intended — do not "fix" by adopting the
  sharer's flags.
- Locale: en "Refinement", zh **精炼** (in-game term).

### Floating edit dock — mounting, gating, state

Visual style (owner-chosen "pop"): a white card floating under the board —
rounded corners, subtle border, drop shadow — visually detached from the panel
strip above it.

**One dock per board** (owner-decided), replacing the panel's
`.tp-actions` cluster:

- **Teams**: mounted in `GridBoard.vue` beside the panel (`:72`), one per board.
- **Arena**: mounted directly in `HomeView.vue` beside its panel
  (`HomeView.vue:305-309`) — **HomeView does not use `GridBoard`**, so it needs
  its own mount row (missing this ships an Arena with no clear/bulk controls).
- **ShareView**: none.

**Mount gate: `info.heroCard && !readonly`** — identical to today's panel mount
(`GridBoard.vue:72`, `HomeView.vue:305-306`). This matters twice over: (a)
`heroCard` defaults off, and an unconditional dock would hand every
default-prefs Teams user five trash-only bars whose team-clear trashes sit
beside the existing per-board board-clear trash (`GridBoard.vue:103-111`) —
three differently-scoped trashes per board; (b) HomeView's map-editor and debug
states suppress the whole info view via `GRID_INFO_NONE`
(`HomeView.vue:152, 314-316`), so the `heroCard` gate keeps the dock out of the
map editor for free.

**Within the dock**: the trash always renders; the P/R bulk clusters and the
selector gate on the layer prefs (`paragon` / `refinement`); with both layer
prefs off the dock is trash-only (matching today's paragon-off head,
`TeamPowerPanel.vue:177,191`). **Per-side state matrix**: under `teamView` the
enemy cluster and enemy trash are hidden (the panel already crops the enemy
side, `TeamPowerPanel.vue:76-79` — destructive controls must not target
invisible units); a side with no real heroes has its cluster and trash disabled.

**Armed-layer state — `useAttrLayerSelection`, module singleton** (the
`useSelectionState` / `useDragDrop` idiom):

- One page-global armed set; **every dock renders the same state and any chip
  toggles it page-wide** (never per-board).
- Default `{P}` (matches today's tap-cycles-paragon); session-only, not
  persisted.
- **No route-change or rebuild reset needed** — unlike `useSelectionState`
  (force-cleared on rebuilds, `useTeamsRestore.ts:85-89`) it references no
  boards or hexes. Provide a test-reset export (module singletons are the
  awkward part of pref tests already).
- **Pref interaction**: the *effective* armed set is
  `armed ∩ pref-visible layers`; when that intersection is empty, the visible
  layers act as armed; with no layers visible, portrait taps no-op. This
  prevents invisible edits (e.g. `{R}` armed, refinement pref then disabled —
  taps must not silently mutate an unrendered value).

Layout per dock, selector centered:

```
[🗑] | ALLY  ↺ ⌃ +1        [P][R]        +1 ⌃ ↺  ENEMY | [🗑]
```

- **Trash**: existing `clearTeam` behavior including the armed two-step confirm
  (`useArmedConfirm`), the confirm-ping pulse (`styles/controls.css`), **and the
  gesture-state clearing** (`clearTargetHex`/`clearLiftedHex`,
  `TeamPowerPanel.vue:113-121`) — that clearing moves with the trash.
- **Bulk clusters** per side, acting on the effective armed layer(s) of that
  board: `↺` reset to 0, `⌃` max to 4, `+1` increment (clamped). Disable
  semantics carry over (raise disables at all-max rather than hides,
  `TeamPowerPanel.vue:92-96`). The action-tip tooltip pair and its
  close-on-click discipline (`TeamPowerPanel.vue:157-165`, every handler calls
  `hideActionTip`) move with the cluster.
- **Selector (V2)**: independent toggle chips `P` / `R`; one lit = armed; both
  lit = ALL; last lit chip can't turn off.
- **Narrow widths**: the ~12 controls must fit the fixed-medium Teams column —
  define a container-query collapse tier (drop the ALLY/ENEMY labels, tighten
  gaps) the way the panel drops its stat caption (`TeamPowerPanel.vue:371-380`).

### Armed-layer feedback (neutral)

No per-layer colors. Two signals, both in the app's default accent: the armed
selector chip renders filled (both in ALL), and the corresponding badges get a
2px ring (both sets in ALL). Bulk chips keep their neutral resting style.

### Edit semantics

- Portrait tap, single effective layer: cycle that layer (+1 wrapping 4→0),
  matching today (`TeamPowerPanel.vue:81-83`).
- Portrait tap in ALL: **+1 both layers, clamped at max — except when every
  armed layer is already at max, in which case the tap wraps them all to 0**
  (owner decision: max-everything then tap again resets, matching the
  single-layer wrap). Mid-range values still never wrap independently, so the
  two counters can't desync. Implemented as **two `setAttr` calls, not
  `setAttrs`** (replace semantics would force a read-modify-write that drops a
  future third attr if assembled naively; Vue's watcher scheduling coalesces
  the writes into one autosave).
- Bulk chips in ALL apply to both layers.

### Panel restructure budget (slice 2, `TeamPowerPanel.vue`)

Moves to the dock: `.tp-actions` + handlers + action tooltips, enemy-mirror
`row-reverse` rules (`:336-346`), armed styles + confirm-ping (`:455-473`).
Stays: stat + `useInfoTip` tooltip, heroes flex sizing, container tiers — but
the head `v-if` collapses from `showParagon || !readonly` (`:177`) to
`showParagon`, the 499px caption-drop tier deletes, and the 319px tier +
`min-height: 28px` were sized around the chips and need re-tuning. Budget this
as a real restructure, not an hour's edit.

---

## 5. Execution plan

Slice 1 is **one release and defensibly one PR** — the `p`→`u` rename is
compile-coupled through the codec (`binaryEncoder.ts:219, 323, 427` read
`state.p`), the panel (`TeamPowerPanel.vue:50+`), restore, side-load, and the
serializer callers; no intermediate point both compiles and preserves data. If
split, stack commits inside one PR. Slice 1 is user-invisible (paragon behavior
unchanged, panel migration is script-only).

Validate each slice with `npm run lint`, `npm run type-check`, and
`npx vitest run --no-file-parallelism`.

Comment churn to plan for (CLAUDE.md comment rules): paragon-specific narrative
comments in `useGridContext.ts:189-195, 291, 327, 408-411`,
`grids.ts:294, 327, 341-344, 401`, `gridStateSerializer.ts:15, 93-94`,
`sideLoad.ts` header + `:29-31`.

### Slice 1 — data layer (format + state, invisible to users)

| File | Change |
| ---- | ------ |
| `src/lib/characters/attributes.ts` | **New.** Registry, named attrId exports, clamp helper, row comparator (registry-owned — survives shim deletion). |
| `src/utils/gridStateSerializer.ts` | `GridState.p` → `u`; attrs getter param; sorted sparse emission (base heroes only, as today); `BOARD_CONTENT_KEYS` `'p'`→`'u'`. |
| `src/utils/upgradeMigration.ts` | **New, TEMPORARY.** Decode-side conversion (row filter/clamp/dedupe/sort; always deletes `p`) + one-time storage pass (`ActiveSlot`-envelope-preserving slot rewrite; `canonicalTeamData` library rewrite, raw-preserving) + marker-LAST `stargazer.migration.u`; header documents accepted races; removal runbook per §2. |
| `src/utils/urlStateManager.ts` | Invoke the shim's conversion in `decodeMultiGridStateFromUrl` (one deletable call). |
| `src/App.vue` | Invoke the storage pass once at setup (SSR-guarded), before route children mount (one deletable call + ordering comment). |
| `src/utils/binaryEncoder.ts` | **Generic upgrades section behind bit 3 carries all attrIds** (appended after synergy; 6-bit count, 27-bit entries per §2; characterId 0 permitted). Bit-1 paragon section retired: encode path and its constants (`:15-18`) deleted; a TEMPORARY decode branch (tagged, in the shim runbook) converts a legacy bit-1 section to attrId-1 `u` rows. `validateGridState` clamps `u` against the registry, drops unknown/unpinned attrIds. |
| `src/composables/useGridContext.ts` | Attrs map; `getAttr`/`setAttr`/`takeAttrs`/`setAttrs` (replace semantics); `clearParagon`→`clearAttrs` (`:394,400`); interface update. |
| `src/components/grid/TeamPowerPanel.vue` | **Mechanical script-only migration** of the dropped wrappers (`:50, 82, 89, 101, 107` → `getAttr`/`setAttr` with `ATTR_PARAGON`); no template or visual change. |
| `src/stores/grids.ts` | Whole-record take/set at `:295, :328-331, :521`; `collectMainUnits` + restore (`:344-359, :404, :409`). |
| `src/stores/urlState.ts` | Restore reads `u` → `setAttr`, ignoring unknown attrIds (`:145-154`). |
| `src/lib/teams/sideLoad.ts` | `SideLoadUnit.paragon` → attrs record from `u` (`:96`, doc comment). |
| `src/composables/useGridPersistence.ts`, `src/views/HomeView.vue` | Attrs getter (`:97,:134`; `:253`). |
| `src/lib/teams/savedTeam.ts` | `canonicalTeamData` sorts `u` rows and drops unknown attrIds; comment updates. |
| Tests — new/updated | `attributes` registry contract; `gridStateSerializer.test.ts` (key contract, sorted sparse `u`); `binaryEncoder.test.ts` (generic-section round-trip incl. paragon + refinement together and characterId-0 rows; **upgrades-only board sets the extended header**; **section-after-synergy byte fixture**; out-of-range clamp; registry-ranges-fit-4-bit-value pin; wire-attrId pin; legacy bit-1 decode fixture in a grep-able `describe('upgradeMigration …')` block, deleted with the shim); `upgradeMigration.test.ts` (conversion; row-filter fixtures: short/non-numeric/duplicate rows, both-keys deletes `p`; envelope preservation for slots; raw-preserving library pass; marker-last + retry-on-failed-write; idempotence); legacy-`p` cases in `urlStateManager.test.ts` / `savedTeam.test.ts` inside grep-able `describe('upgradeMigration …')` blocks (incl. legacy record canonicalizes byte-equal to fresh snapshot); unknown-attrId decode fixture; `sideLoad.test.ts`; known breakers: `stores/urlState.test.ts:124`, `stores/grids.test.ts:348-364, 414-475, 617, 688, 766`, `composables/useGridContext.test.ts:79+`. |

### Slice 2 — UI

| File | Change |
| ---- | ------ |
| `src/composables/useAttrLayerSelection.ts` | **New.** Module-singleton armed set per §4 (default `{P}`, effective = armed ∩ visible, last-lit guard, test-reset export). |
| `src/composables/useGridInfoPrefs.ts` | `refinement` key (+`GRID_INFO_NONE`), parent under `heroCard`. |
| `src/components/grid/GridInfoToggle.vue` | Checklist row (`:42` pattern). |
| `src/components/grid/TeamPowerPanel.vue` | Restructure per §4 budget: head → stat only; slanted split pill (supersedes corner badges), new palette; tap editing per effective layer(s); armed rings. |
| `src/components/grid/TeamPowerDock.vue` | **New.** Per-board dock per §4: trash (armed confirm + gesture clearing) + per-side clusters (teamView/empty-side matrix) + centered selector + narrow-width collapse tier. |
| `src/components/grid/GridBoard.vue` | Mount dock beside the panel (`:72`, same `info.heroCard && !readonly` gate); thread the refinement view flag (also via `TeamsBoards.vue`). |
| `src/views/HomeView.vue` | **Mount `TeamPowerDock`** beside the Arena panel (`:305-309`), same gate; thread `refinement` flag (`:308`). |
| `src/views/TeamsView.vue`, `src/views/ShareView.vue` | Thread `refinement` flag (`ShareView.vue:164,181`); ShareView gets no dock. |
| `src/locales/app/` | New `refinement.json` (en "Refinement" / zh 精炼) + selector aria strings + refinement/ALL bulk variants; existing `messages/{max-paragons,raise-paragons,reset-paragons,paragon-cycle}.json` generalize or gain siblings (all four exist). |
| `docs/architecture/GRID.md`, `TEAMS.md`, `URL_SERIALIZATION.md` | Attrs, `u`, shim (with removal note), dock. |
| Tests | Dock: teamView-filtered, empty-side, armed-state shared across docks, effective-armed pref interaction, ALL-mode clamp + wrap-when-all-max; panel: badge corners/palette; cross-board move carrying refinement; clearTeam wiping both attrs; full `u` round-trip save/load/share/import. |

### Slice 3 — notebook side (afkj-pvp)

Read `u` rows from shared links (attrId 1 = paragon, 2 = refinement).

---

## 6. Verified assumptions & corrections

1. **Arena format is binary, not JSON** — its legacy support is the temporary
   bit-1 decode branch, deleted with the shim; the encoder writes only the
   generic bit-3 section from day one. After removal, old paragon-bearing
   Arena links load an empty board (accepted); the arena autosave is protected
   by the storage pass and the upfront rewrite.
2. **Single decode choke point confirmed** for all multi-board JSON consumers
   (incl. `useTeamsRestore.ts:78,145` and `ShareView.vue:39`).
3. **Transfer surface** is the 10-row table in §3.
4. **Badge today**: upper-right, per-tier colors; new scheme is corner-split and
   gray-until-max.
5. **Prefs need no migration** (`sliceFrom` merges over defaults).
6. **`preview.ts` unchanged**; canonicalization is key-driven.
7. **No corruption paths found** by any review — every failure mode is clean
   loss, enumerated in §2's accepted-consequences paragraph and explicitly
   accepted by the owner.
8. **HomeView/ShareView mount panels directly** — `GridBoard.vue` is Teams-only;
   the Arena dock needs its own mount (round-2 catch).
9. **Mode slots are `ActiveSlot` envelopes** — the storage pass rewrites
   `slot.data` only, preserving `v`/`sourceId`/`defaults` (round-2 catch; a
   bare rewrite would fail the `v===1` load check and hard-reset all four
   modes).

## 7. Audit summary

**Round 1** (senior engineer + architect): merged the compile-coupled
format/state slices; promoted the binary bit-3 section from optional (refinement
edited on the Arena would have been silently dropped by autosave); resolved the
dock scoping contradiction (per-board + singleton composable); required sorted
conversion/canonicalization (phantom-dirty prevention); scoped the characterId-0
sentinel claim down to a reservation; moved gesture clearing with the trash;
named missing files and breaking tests. The round-1 architect's recommendation
to make the shim permanent was **overruled by the owner** (temporary by policy;
losses accepted) and that reviewer's citation of `resolveTeamMode` as a
migration precedent was wrong — it is a graceful default for a field that never
existed in old payloads, not a migration shim.

**Round 2** (staff engineer + fresh architect, briefed on the settled
constraints): caught the `ActiveSlot` envelope (bare slot rewrite = board wipe);
inverted the marker discipline to marker-last (idempotent pass; marker-first
would convert a transient quota failure into permanent loss); named the marker
key and the `App.vue` call site; caught the missing Arena dock mount (HomeView
doesn't use GridBoard) and pinned the dock gate to `info.heroCard && !readonly`
(avoiding a three-trashes-per-board default-UI regression); specified the
teamView/empty-side matrix and the `useAttrLayerSelection`
armed-∩-visible rule (no invisible edits); raised the unknown-attrId question
(resolved as drop-everywhere once corrected against the owner's
single-deployment model — the reviewer's version-skew scenario cannot occur)
and pinned the malformed-row
contracts as fixtures; added the refinement-only-header and
co-presence codec fixtures; verified wire capacity against the real 5-hero
team cap;
pinned ALL-tap as two `setAttr` calls; pulled `TeamPowerPanel` into slice 1
(wrapper drop is compile-coupled); enumerated the removal runbook and grep-able
legacy test blocks; confirmed slice 1 as one PR.

## 8. Decision log

### Owner-decided (from the design conversation)

- **Deployment model**: the app is a single hosted deployment — "once it
  updates there won't be old versions available anywhere else." No design may
  assume version skew (old clients reading new data, rollbacks, parallel
  versions); the only transient exception is a stale browser tab open across a
  deploy.
- **Migration policy**: shims are TEMPORARY — one deletable module + runbook,
  deleted ~1 month after release; permanent conversion/translation fallbacks
  are out of policy (CLAUDE.md). Old links and old export files are explicitly
  expendable after removal.
- **Pill palette**: gray `#cfc8bb`/`#4a463d` for P0–P3 and R0–R1;
  **R2–R3 light red tint `#f5cdc2`** (dark text, mid progress visible);
  P4 `#8fa7c8` white text (S3); **R4 `#e4938a` white text** (iterated live
  from the original #dd7a6c). The pill keeps a white border (1.5px at pill
  scale).
- **Split pill, not corner badges** (iterated live after corner badges
  overlapped between neighbors on 5v5 boards): one slanted split pill under
  each portrait — P half left, R half right, 112° seam with an always-visible
  white sliver so all-gray pills stay consistent; a lone visible layer keeps
  pill proportions via a raised min-width (Option A) instead of collapsing to
  a near-circle.
- **Selector**: V2 independent P/R toggle chips (both lit = ALL).
- **Control colors**: neutral — no per-layer tinting; armed feedback is the
  filled selector chip + badge rings only.
- **Locale**: zh 精炼.
- **Serialization: generic `u` key** — chosen over a sibling `r` key with the
  trade-offs re-examined under the temporary-shim policy; future extensibility
  is non-negotiable, and at 10+ upgrade types the sibling-key option costs
  per-attr boilerplate forever plus a binary format extension after two more
  attrs, versus `u`'s one-time shim. The generic bit-3 upgrades section (§2)
  follows from the same call, and **paragon rides it too**: the binary bit-1
  paragon section is deleted, not kept as a live special case — no legacy wire
  shapes survive the shim window, old paragon-bearing Arena links breaking
  after removal is accepted ("I don't care about links breaking"), and bit 1
  is freed for future reuse after shim deletion rather than permanently
  reserved (reserving it would only protect how expendable links fail).
- **ALL-mode tap wraps at max**: with both layers selected, a tap raises both
  (clamped); when every selected layer is already at max, the tap wraps them
  all to 0 — matching the single-layer wrap.

- **Dock scoping: per-board** — each board keeps its own bar (trash/bulk
  adjacent to what they act on); the P/R selection is one page-global state
  shared by all bars (any chip toggles page-wide), with the supporting rules
  in §4.

All design decisions are settled; the design is implementation-ready.

### Audit-derived specifications (recommendations, standing unless overruled)

Shim mechanics (sorted conversion, envelope-preserving storage pass,
raw-preserving library rewrite, marker-last retry, `App.vue` call site) — A
only; dock gating (`info.heroCard && !readonly`), teamView/empty-side matrix,
`useAttrLayerSelection` defaults and armed-∩-visible rule, ALL-tap as two
`setAttr` calls, unknown-attrId (drop everywhere) and malformed-row contracts, named test
fixtures.
