# Design: Team Modes (N-Grid) & Saved Teams

> **Status**: Proposal — awaiting review
> **Scope**: Teams page (`/teams`) only. The Arena (`/`), Map Editor, and WandWars are untouched.
> **Companion mocks**: [`mocks/saved-teams-tab.html`](./mocks/saved-teams-tab.html), [`mocks/team-mode-controls.html`](./mocks/team-mode-controls.html)

## Overview

This design generalizes the 5v5 tab into a **Teams** tab that supports a configurable number of boards ("team modes": 3v3, 5v5, 5v5 Supreme League), with fully independent persisted state per mode. On top of that it adds a **Saved Teams** library: named snapshots of any N-grid team that can be selected, duplicated, deleted, exported to JSON, and imported back.

Both features reuse the existing multi-grid serialization codec (`MultiGridState`) as the single snapshot format — the same string that powers share links and localStorage autosave becomes the unit of "a saved team".

---

## 1. Current Architecture (Investigation Findings)

Everything below was verified against the current `main` (`0dc6101`).

### 1.1 The board array is a single global instance

- `useGrids` (`src/stores/grids.ts`) is a global Pinia store owning `contexts: GridContext[]` (the boards), `activeId`, and cross-board rules (page-wide character/artifact uniqueness, drop routing, board swap). `MAX_GRID_COUNT = 5` (`grids.ts:36`).
- Each board is a `GridContext` (`src/composables/useGridContext.ts`) — a self-contained reactive entity: its own `Grid`, `SkillManager`, `currentMap`, artifact slots, paragon map, and a `dispose()` for its watchers.
- `setGridCount(count, maps?)` (`grids.ts:95`) **disposes and rebuilds the whole array**. The Arena is the `setGridCount(1)` case; the 5v5 page is `setGridCount(5)`.
- `useGridStore` (`src/stores/grid.ts`) is a _view over the active context_ — legacy single-board API used by the Arena and shared components. Whatever is "active" in `useGrids` is what it reads/writes.

**Consequence:** there is exactly one live board array in the app. Any two UI surfaces that both configure it (e.g. two sibling tabs "5v5" and "3v3") are writers to the same instance. This is the structural reason the previous 3v3-tab attempt corrupted state (see §1.5).

### 1.2 How the Teams page configures boards today

`TeamsView.vue`:

- Outer `TabView` with tabs `fiveVFive` and `imageStitcher` (`TeamsView.vue:52-55`).
- A `GRID_TABS` record maps tab key → `{ count, maps }`; a single `watch(activeTab)` is **the only writer** of the board count (`TeamsView.vue:83-106`). The comment explicitly anticipates this design: _"a future grid mode (e.g. 3 v 3) drops in as one entry"_.
- `FIVE_V_FIVE_DEFAULT_MAPS = ['arena1', 'arena2', 'arena3', 'preset-sr11', 'preset-sr1']` (`src/lib/maps.ts`) supplies the hardcoded per-board maps; its length doubles as the board count.
- On leave, `onScopeDispose` resets to `setGridCount(1)` for the Arena.
- Display flags (`showArrows`, `showGridInfo`, `showPerspective`, `showSkills`, `teamView`, `inverted`, `wrap`) are page-level state via `useDisplayFlags`, bit-packed into the serialized `d` field (`gridStateSerializer.ts:149-159`, wrap = bit 6).
- The **Wrap** toggle (3-2 board layout) renders only when `showWrapToggle` is passed (`GridControls.vue:53`), is desktop-only (`canWrap = !isSheet`), and its CSS is 5-board-specific (`BoardsRow.vue:65-78` centers `:nth-child(4)/(5)`).

### 1.3 Persistence & URL serialization

- **Snapshot format**: `MultiGridState = { boards: BoardState[], active?, d? }` where `BoardState = GridState & { m?: string }` (per-board map key). It is **already count-agnostic** — `boards` is an array (`gridStateSerializer.ts:163-171`).
- **Encoding**: URL-safe base64 of JSON (`encodeMultiGridStateToUrl`, `urlStateManager.ts:33-35`). The single-board Arena uses a separate binary codec; multi-board deliberately does not (`urlStateManager.ts:30-32`).
- **localStorage**: `useGridPersistence.ts` writes the _same encoded string_ a share link carries to fixed keys: `stargazer.arena`, `stargazer.teams`. Autosave = one immediate write + a `watch` on the encoded snapshot (`useGridPersistence.ts:50-59`). All reads/writes are SSR-guarded and quota-tolerant (best-effort try/catch).
- **Restore**: `useUrlStateStore.restoreMultiFromEncodedState` (`urlState.ts:194-226`) decodes, clamps `boards.slice(0, MAX_GRID_COUNT)`, calls `setGridCount(boards.length, maps)`, applies each board by temporarily making it active, then `dedupeCharacters()` repairs page-wide uniqueness against crafted URLs.
- **Priority**: on `/teams` load, `?g=` wins over the saved slot; a failed decode falls back to the slot; `startAutosave()`'s initial write is what commits the `?g=` payload over the slot (`TeamsView.vue:121-136`). The autosave watch has no stop/dispose handle — it lives until the page's setup scope dies.
- **Measured sizes** (ran the repo's own encoder): a fully-populated board ≈ 460 JSON bytes ≈ 612 encoded chars; a full 5-board team ≈ **3,060 encoded chars (~6 KB as UTF-16 in localStorage)**; an empty 5-board slate ≈ 126 chars. Note `t` is not edits-only — it re-emits the map's baseline available tiles (~26 entries/board), because restore resets all tiles to `DEFAULT` then replays `t`; the per-board `m` key mainly keeps `currentMap` honest for UI highlight.
- **No versioning anywhere**: neither codec has a version field; the de-facto strategy is additive evolution + graceful decode failure (null → treated as absent). Any new persistent structure should carry an explicit version from day one.
- **Existing bug this design fixes**: a crafted 3-board `/teams?g=` link _today_ rebuilds to 3 boards under the 5v5 tab, and the immediate autosave persists those 3 boards into `stargazer.teams` — silently destroying the 5-board save. Mode-routed restore/persist (§3.8) makes this impossible.
- **Share flow**: Link button → copies `/share?g=<encoded>` and navigates to the read-only `ShareView`; its Edit pencil deep-links to `/teams?g=<encoded>` (`ShareView.vue:118-121`), which is exactly the "overwrite active grids" semantic requested.

### 1.4 The roster panel and its tabs

`TeamsRoster.vue` renders a `TabView` with `characters` / `seasonal` / `maps` tabs inside a `BottomSheet` (desktop card / mobile pull-up sheet). The Maps tab is `ArenaPreviewGrid`, which renders **each map as a small inline SVG of hex polygons** (`ArenaPreviewGrid.vue:22-38`) — the exact precedent this design reuses for saved-team thumbnails. Map selection calls `gridStore.switchMap(mapKey)` on the _active_ board.

### 1.5 Why the previous 3v3 tab failed (reconstruction)

Git history has been squashed ("clean up" commits), so the buggy attempt itself is gone, but the failure is fully explained by the current structure:

1. **One board array** — both tabs render `v-for ctx in grids.contexts`; with `TabView eager` both panels are mounted at once and literally show the same boards.
2. **One storage slot** — both tabs' autosaves write `stargazer.teams`. Switching tab rebuilds the array (`setGridCount`), the autosave watcher fires on the new (empty or differently-sized) snapshot, and **overwrites the other mode's save**.
3. **Rebuild-on-switch races** — `watch(activeTab)` only rebuilds when counts differ; restore, autosave start, and flag application are interleaved at page level and were never designed to be re-entrant per tab.

**Design conclusion:** the bug class disappears when (a) _mode is data, not a tab_ — a single owner (one panel, one watcher, one persistence pipeline) reconfigures the one board array, and (b) _each mode has its own storage slot_ with an explicit, ordered switch sequence (flush → rebuild → restore → resume autosave). That is exactly what §3 specifies.

### 1.6 Misc facts the design depends on

- i18n: one JSON file per key in `src/locales/app/` with `{ "en": …, "zh": … }` values; `app.teams` ("Teams"/"阵容") already exists.
- Export precedent: `downloadBlob` + `timestampedName` (`src/utils/download.ts`); toasts via `useToast`. File-import precedent: WandWars records (`WandWarsView.vue:186` area) — export via `downloadBlob(new Blob([...], { type: 'text/plain' }))`, import via a hidden `<input type="file">` behind a button + `await file.text()` + per-entry validation with invalid entries dropped — exactly the shape §3.7 needs. There is no confirm-dialog precedent (destructive actions like Clear act immediately; `BaseModal` is a dark glass overlay that would clash on the cream card).
- Icons are per-glyph SFCs (`src/components/ui/Icon*.vue`, feather-style, `currentColor`): `IconTrash` = delete, `IconCopy` = duplicate, `IconDownload` = export, `IconEdit` = rename already exist; only Save (and optionally an upload/import glyph) are new.
- `/teams` is not SSG pre-rendered (SPA-only route), but all storage code is already SSR-guarded, so no new constraints.
- Tests live in `tests/unit/**` mirroring `src/` (existing suites for `grids`, `urlState`, `gridStateSerializer`, `urlStateManager`) and run via `vitest`.

---

## 2. Decision: How to Present 3v3 — Recommendation

**Recommendation: Option B — a mode control inside a single, generic "Teams" tab.** (The option you were leaning towards; the investigation strongly supports it.)

|                                   | Option A: sibling "3v3" tab                                                             | Option B: mode control in one "Teams" tab                                      |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Fit with existing code            | Duplicates panel wiring; two writers to one global board array (the prior bug class)    | `GRID_TABS` record becomes a mode registry; still exactly one writer           |
| Extensibility (2-grid, 4-grid, …) | New tab + panel each time                                                               | One registry entry                                                             |
| Saved teams fit                   | A saved team's mode ≠ visible tab → awkward ("select a 3v3 team while on the 5v5 tab?") | Mode is part of team identity; selecting a team just switches the mode control |
| Mobile                            | Another top-level tab competing for width                                               | One tab; the mode picker is a compact segmented control                        |
| Risk                              | Re-introduces the eager-mounted shared-instance problem                                 | Bug class structurally removed                                                 |

The one thing Option A offers — a big visible "3v3" label — Option B keeps via the segmented control, which doubles as the future entry point for arbitrary team sizes.

One more point for Option B that is easy to miss: **today the Teams page shows no outer tab strip at all on mobile** — `TabList` hides the whole bar when `hideMobile` tabs leave ≤ 1 visible button (`TabList.vue:26`), and Image Stitcher is `hideMobile`. A sibling 3v3 tab would make a tab strip appear on mobile for the first time (new chrome, new vertical space); the mode picker keeps the strip hidden and adds only one compact control row.

**Tab rename**: the outer tab `5 v 5` → **Teams** (reuse existing `app.teams` key). The Image Stitcher tab is unchanged.

---

## 3. High-Level Design

### 3.1 Team mode registry

New module `src/lib/teamModes.ts` — the single source of truth for modes (replaces `GRID_TABS`):

```ts
export type TeamModeKey = '3v3' | '5v5' | '5v5sl'

export interface TeamModeConfig {
  key: TeamModeKey
  labelKey: string // i18n key for the mode picker
  boardCount: number
  defaultMaps: string[] // length === boardCount
  canWrap: boolean // wrap layout only makes sense for 5-board modes
}

export const TEAM_MODES: Record<TeamModeKey, TeamModeConfig> = {
  '3v3': {
    key: '3v3',
    labelKey: 'app.mode-3v3',
    boardCount: 3,
    defaultMaps: ['arena1', 'arena1', 'arena1'],
    canWrap: false,
  },
  '5v5': {
    key: '5v5',
    labelKey: 'app.mode-5v5',
    boardCount: 5,
    defaultMaps: ['arena1', 'arena1', 'arena1', 'arena1', 'arena1'],
    canWrap: true,
  },
  '5v5sl': {
    key: '5v5sl',
    labelKey: 'app.mode-5v5-sl',
    boardCount: 5,
    defaultMaps: FIVE_V_FIVE_DEFAULT_MAPS,
    canWrap: true,
  },
}

export const DEFAULT_TEAM_MODE: TeamModeKey = '5v5sl' // today's behavior
export const isTeamModeKey = (k: unknown): k is TeamModeKey =>
  typeof k === 'string' && k in TEAM_MODES
```

Notes:

- `MAX_GRID_COUNT` stays 5 and stays the clamp for crafted URLs.
- `FIVE_V_FIVE_DEFAULT_MAPS` moves conceptually into this registry; keep the export in `lib/maps.ts` (Share/others may reference it) but the registry is what the Teams page reads.
- Adding a future 2-grid/4-grid mode = one entry here + two i18n files. Nothing else.

### 3.2 Per-mode active team state (localStorage)

| Key                                | Content                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `stargazer.arena`                  | unchanged (Arena binary-encoded string)                                   |
| `stargazer.teams.active.<modeKey>` | encoded `MultiGridState` — the mode's **active team** (autosaved)         |
| `stargazer.teams.mode`             | last selected `TeamModeKey` (restore on revisit)                          |
| `stargazer.teams.saved`            | the saved-teams library (JSON, §3.4)                                      |
| `stargazer.teams`                  | **legacy** — migrated once → `stargazer.teams.active.5v5sl`, then removed |

Migration (one-time, on Teams page init, before restore): if `stargazer.teams` exists and `stargazer.teams.active.5v5sl` does not, copy it over; delete the legacy key in either case. Legacy content is today's 5v5 = Supreme League.

### 3.3 The mode switch sequence (the critical invariant)

`useGridPersistence.ts` gains a mode-aware Teams persistence with an explicit pause + flush, replacing the single-slot `useTeamsPersistence`:

```ts
// sketch — useTeamsPersistence(modeKey: Ref<TeamModeKey>, getFlags)
const paused = ref(false)
const keyFor = (m: TeamModeKey) => `stargazer.teams.active.${m}`
// snapshot() = encodeMultiGridStateToUrl(serializeMultiGridState(...)) as today
watch(snapshot, (encoded) => {
  if (!paused.value) writeSlot(keyFor(modeKey.value), encoded)
})
```

`TeamsView` owns `activeMode = ref<TeamModeKey>(…)` and performs every switch in this exact order:

1. `paused = true`
2. flush: write current snapshot → `keyFor(oldMode)` _(normally a no-op — autosave already mirrored it)_
3. `activeMode = newMode`; persist `stargazer.teams.mode`
4. `grids.setGridCount(cfg.boardCount, cfg.defaultMaps)`; `clearTargetHex()`; `clearLiftedHex()` _(same hygiene as today's tab watcher, `TeamsView.vue:96-101`)_
5. restore `keyFor(newMode)` via `urlStateStore.restoreMultiFromEncodedState` if present (apply its display flags); otherwise the fresh defaults from step 4 stand
6. if `!TEAM_MODES[newMode].canWrap`, force `wrapBoards = false` (keeps the serialized `d` bit-6 at 0 for 3v3 snapshots)
7. `paused = false`; write one baseline snapshot to `keyFor(newMode)`

This ordering is what makes "edit 5v5 → switch to 3v3 (clean slate) → switch back (edits intact)" hold by construction: a mode's slot is only ever written while that mode's boards are live. **A dedicated regression test for this sequence is part of Phase 1** (§5) — it is the exact failure of the previous attempt.

> ⚠️ **Equal-count trap**: today's tab watcher skips the rebuild when the target count equals `contexts.length` (`TeamsView.vue:97`) — an optimization for the Image Stitcher round-trip. A mode switch must **not** inherit that check: `5v5 → 5v5sl` keeps the count at 5 but changes maps and state, so step 4 always rebuilds. (Toggling to the Image Stitcher tab and back is not a mode switch and still leaves boards untouched.)

Three details of the sequence, verified against current behavior:

- **Restore → `applyFlags` → arm autosave, in that order** (today's order, `TeamsView.vue:124-135`): the baseline write must reflect the restored display flags, or it persists stale ones.
- **`activeId` is not reset by `setGridCount` when still in range** (`grids.ts:101`) — switching 5v5 (active board 2) → 3v3 keeps board 2 active; the restore then applies the snapshot's own `active` field. Don't assume a reset.
- **Corrupt-slot asymmetry (existing behavior, inherited)**: a bad `?g=` preserves the saved slot (decode failure → fallback), but a corrupt _slot_ is overwritten with fresh defaults by the baseline write. Acceptable (the slot was unreadable anyway), but worth knowing when debugging.

Nothing about `useGrids`, `GridContext`, drag & drop, uniqueness rules, or skills changes: they are already count-agnostic (`contexts.length` is the only truth they read).

### 3.4 Saved Teams library

New Pinia store `src/stores/teamLibrary.ts`:

```ts
export interface SavedTeam {
  id: string            // crypto.randomUUID()
  name: string          // user-editable; default "Team N"
  mode: TeamModeKey
  data: string          // encoded MultiGridState — same codec as share links/autosave
  createdAt: number     // epoch ms
  updatedAt: number
}

// stored under 'stargazer.teams.saved' as { v: 1, teams: SavedTeam[] }

export const useTeamLibrary = defineStore('teamLibrary', () => {
  const teams = ref<SavedTeam[]>([])           // hydrated once from storage, mirrored on change
  const saveActive = (mode, data, name?) => SavedTeam | null   // null when at cap
  const select = (id) => SavedTeam | undefined  // caller switches mode + restores
  const remove = (id) => void
  const duplicate = (id) => SavedTeam | null    // "<name> (copy)", fresh id, at-cap guarded
  const rename = (id, name) => void
  const exportAll = () => TeamsExportFile
  const importTeams = (file: unknown) => { imported: number; skipped: number; error?: string }
})
```

Semantics:

- **Save** creates a _new_ snapshot from the current active team (name auto-generated `Team 1..N`, immediately renameable). Saved teams are immutable snapshots — editing the active team never silently mutates a saved one. _(Open question #2 covers an explicit "update" affordance.)_
- **Select** = load into the active slot: switch `activeMode` to `team.mode` (full §3.3 sequence), then `restoreMultiFromEncodedState(team.data)`, then baseline-write the slot. This **overwrites** that mode's active team, per your spec; a toast confirms ("Team loaded").
- **Delete** removes the record. UI uses a two-step inline confirm (button arms → "Confirm?" for ~3s), consistent with the app's no-modal style; the active boards are unaffected (they hold a copy).
- **Duplicate** copies the record with a new id/name.
- The active team keeps **no provenance link** to the record it was loaded from — simplest correct model given saves-are-snapshots.

**Why store the encoded string (not raw JSON)?** It reuses the exact codec + validation path of share links (`decodeMultiGridStateFromUrl` is the integrity check), keeps the library entries directly shareable (`/share?g=<data>` works verbatim, enabling a per-team Share action later), and makes export/import trivially round-trippable.

**Size & limits** (answering your question): **measured with the repo's own encoder**, a fully-populated 5-board team is ≈ 3,060 encoded chars ≈ **6 KB** as stored (localStorage is UTF-16); a 3-board team proportionally less. Against the typical ~5 MB/origin quota, even 100 teams ≈ 600 KB is comfortably safe. **There is no technical need for a tight cap; recommend a soft cap of `MAX_SAVED_TEAMS = 50`** purely for list UX, enforced in `saveActive`/`duplicate`/`importTeams` with a toast. The quota risk would only appear if thumbnails were ever _stored_ as images (20–100 KB+ each) — which §3.5 deliberately avoids. Quota errors are already handled as best-effort (silent catch) in the storage helpers; the library additionally surfaces a toast on a failed _save_ (unlike autosave, the user explicitly asked for it).

### 3.5 Thumbnails

`TeamPreview.vue` renders a saved team **from its data, as SVG** — decode `team.data`, and for each board draw the map's hex polygons (same approach and fills as `ArenaPreviewGrid.vue:40-53`) plus a **team-colored dot** (ally teal / enemy red, `--color-ally`/`--color-enemy` at full opacity) on each occupied tile. Boards render side by side (N boards ≈ 40×40px each at list size).

- No images are generated or stored — thumbnails are derived views, always in sync with the data, zero storage cost, crisp at any DPI.
- Decode once per card (memoized computed); a corrupt record renders a fallback tile with a warning glyph instead of breaking the list.
- Character portraits inside dots are a possible later enhancement — `GridSnippet.vue` (guide pages) already renders portraits as SVG `<image>` elements clipped to hex shapes, so the v2 upgrade path is proven in-repo. v1 dots keep the card readable at small sizes (mock shows the effect).
- Note the DOM-capture path (`useGridExport` / html-to-image) is **not** viable here: it only captures mounted DOM, and saved teams are by definition not the live boards. Data→SVG is the only correct source.

### 3.6 New controls row (TeamModeControls)

New component `src/components/teams/TeamModeControls.vue`, rendered by `TeamsBoards.vue` **above** the existing `GridControls` row:

- **Mode picker** — segmented control: `3v3 · 5v5 · 5v5 Supreme League` (from `TEAM_MODES`; hardcoded set for now, per spec). Switching is instant and lossless (each mode keeps its own state), so no confirmation is needed — worth stating in the UI via tooltip.
- **Save** — primary button (new `IconSave`); saves active team to the library (§3.4), toast + brief badge pulse on the Saved Teams tab.
- **Export** — downloads all saved teams as JSON (§3.7).
- **Import** — hidden `<input type="file" accept="application/json">` behind a button (§3.7).

Existing `GridControls` row changes: `show-wrap-toggle` becomes `canWrap && TEAM_MODES[activeMode].canWrap` — i.e. the Wrap toggle simply doesn't render in 3v3 (`BoardsRow`'s wrap CSS is also gated to 5-board tracks; a 3-board track always fits one row). Everything else (Flat, Grid Info, Team View, Skills, Targeting, Invert, Link, Copy, Download, Clear) is unchanged and applies to whatever boards are live.

**Other controls considered** ("any other grid controls?"):

- _Recommended for v1_: **active-team name label** in the row (shows what you're editing; doubles as rename affordance later) — cheap and orients the user. Include only if trivial; otherwise defer.
- _Defer_: unsaved-changes dot on Save (needs dirty-tracking vs. library), **Reset team** (clear boards + reset maps to mode defaults — partially covered by existing Clear), per-team **Share** button on saved cards (works for free via `/share?g=<data>`; add when wanted), "Save as…" naming dialog (rename-after-save covers it with less UI).

### 3.7 Export / import format

```jsonc
// stargazer-teams-YYYYMMDD-HHMMSS.json (downloadBlob + timestampedName)
{
  "app": "stargazer",
  "kind": "saved-teams",
  "version": 1,
  "exportedAt": "2026-07-04T08:00:00.000Z",
  "teams": [
    { "id": "…", "name": "…", "mode": "5v5sl", "data": "…", "createdAt": 0, "updatedAt": 0 },
  ],
}
```

Import validation, in order: envelope shape (`app`/`kind`/`version` known) → per-record: `mode` passes `isTeamModeKey`, `name` is a non-empty string (trim/limit 60 chars), `data` decodes via `decodeMultiGridStateFromUrl`, `boards.length === TEAM_MODES[mode].boardCount`, **every board's `m` key exists in `MAPS`** (an unknown `m` would build the default layout while `currentMap` names a nonexistent map — a known footgun in `createGridContext`), **and `d` is present — normalize to `packDisplayFlags` defaults if missing** (`unpackDisplayFlags(undefined)` defaults `showArrows` to **true**, so a hand-crafted record omitting `d` would flip targeting arrows on at load). Valid records are **merged** (never replace): fresh `id`s are assigned; records whose `data` + `name` exactly match an existing team are skipped as duplicates; cap enforced. Result toast: "Imported N teams (M skipped)". A malformed file → error toast, library untouched. Import never touches the active boards.

Two deliberate non-goals: we do not deep-validate `t` tile entries against `m` (a hand-edited mismatch renders `t`'s layout — same lenient behavior as share URLs), and hand-crafted duplicate heroes are handled by the existing restore-time repair (`dedupeCharacters`) when the team is _selected_, exactly like a crafted share URL.

### 3.8 URL serialization & share links

- `MultiGridState` gains an optional `mode?: TeamModeKey` field (serializer writes it; decoder tolerates absence — **no version bump needed**, the format is self-describing JSON and old links must keep working).
- **Mode inference for legacy/absent `mode`**: `boards.length === 3 → '3v3'`; `boards.length === 5 → '5v5sl'` (all pre-feature links are today's 5v5); other counts (crafted): pick the smallest mode with `boardCount ≥ boards.length` and pad with default maps — the existing clamp (`urlState.ts:206`) already handles the too-many case.
- `/teams?g=<encoded>` → decode, resolve mode, **switch the mode picker to it**, and overwrite that mode's active slot (the current priority/fallback/toast logic in `TeamsView.vue:121-136` generalizes unchanged: decode failure → fall back to `stargazer.teams.mode` + its slot).
- `/share` (read-only) needs no functional change (it renders `boards.length` boards already). A 3-board payload with the wrap bit set already degrades gracefully (`BoardsRow`'s `:nth-child(4)/(5)` rules match nothing), so the Phase-4 "gate wrap on `boards.length === 5`" item is cosmetic hardening only.
- Serializer additions are backward-compatible; existing saved `stargazer.teams` strings decode as before (they simply lack `mode`).
- **In-app navigation caveat**: today every entry into `/teams?g=` is a hard navigation (ShareView's Edit pencil is a plain `<a href>`), so the direct `window.location.search` read is always current. If a future feature navigates in-app (e.g. per-saved-team "open in editor" via `router.push`), it must read `getEncodedStateFromRoute` or force a reload — and note `?g=` is never stripped after restore, so a reload re-applies and re-overwrites (existing behavior).

### 3.9 Saved Teams tab (roster panel)

`TeamsRoster.vue` gains a fourth tab: `characters / seasonal / maps / saved` (label `app.saved-teams`, with a count badge via `TabItem.badge`). Panel component `src/components/teams/SavedTeamsList.vue`:

- Responsive card grid; each card: `TeamPreview` thumbnail, mode chip (`3v3` / `5v5` / `5v5 SL`), name (inline-editable on click, Enter/blur commits), relative updated time, and actions **Select** (primary) / **Duplicate** / **Delete** (two-step confirm).
- Empty state: hint text + a ghost "save your first team" pointer to the Save button.
- Cap indicator near the top when ≥ 80% of `MAX_SAVED_TEAMS`.
- Selecting from the mobile sheet collapses the sheet (same pattern as character placement, `TeamsRoster.vue:44-51`) so the loaded boards are visible immediately.

See the HTML mock for the exact look (desktop card + mobile sheet variants).

### 3.10 Invariants the implementation must preserve

These are documented (GRID.md / ARCHITECTURE.md) or load-bearing behaviors; the design deliberately routes around all of them — an implementer must not "simplify" across them:

1. **Bulk state application goes through `restoreMultiFromEncodedState` — never a bespoke loader.** The existing path encapsulates non-obvious ordering: per-board apply via temporary `setActive`, companions settled per-main, `dedupeCharacters()` after _all_ boards (per-board checks can't see cross-board duplicates), `seedPhantimalBaseline()` last (phantimal auto-placement is edge-triggered; a restore must not read as a transition). Saved-team Select and mode-switch restore both reuse it and inherit all of this for free.
2. **Exactly one writer of the board count on the page** (`TeamsView.vue:2-8` header contract). The mode switcher takes over that role from the tab watcher; nothing else may call `setGridCount` on `/teams`.
3. **Mode switch always rebuilds; Image-Stitcher tab round-trip never rebuilds.** Two different semantics currently share one watcher (the §3.3 equal-count trap) — keep them as two separate code paths.
4. **`onScopeDispose` still resets to `setGridCount(1)` on leave** (Arena handoff, HMR-safe). Per-mode slots are already flushed by then because the autosave watcher was armed on the correct key the whole time.
5. **`MAX_GRID_COUNT = 5` clamps everything** (crafted URLs and imports must not build arbitrary board counts).
6. **Page-wide (character, team) and (artifact, team) uniqueness across boards** — never place around it; always go through the store APIs that enforce it.
7. **Display globals (`teamView`, `inverted`) are reset at page setup** so a first visit never inherits another page's toggles; a restored `inverted` flag only relabels — it must never re-trigger the unit mirror-swap.
8. **Selection state is board-qualified and boards share hex ids** — `clearTargetHex()` / `clearLiftedHex()` after every rebuild (§3.3 step 4).
9. **Layering rule** (ARCHITECTURE.md): composables may call stores; stores must never call composables. `useTeamLibrary` is a store (no composable imports); the switch/restore orchestration lives in a composable (`useTeamsRestore`) or the view.
10. **`startAutosave`'s initial unconditional write is load-bearing** — it is what commits a `?g=` payload over the slot. Keep the order: restore first, then arm autosave (which writes the baseline).

---

## 4. Architecture Assessment (refactor vs. bolt-on)

**No major refactor is needed — and that is a finding, not a compromise.** The 2024-vintage parts of this codebase were already reworked into the shape a from-scratch design would choose: per-board state is encapsulated in `GridContext`, the collection + cross-board rules live in one store, the snapshot codec is count-agnostic, and the page already declares "modes as data" (`GRID_TABS`). The design therefore _completes_ existing seams rather than fighting them:

- `GRID_TABS` → `TEAM_MODES` registry (same idea, promoted to a lib module with types).
- Single teams storage slot → keyed slots + explicit switch protocol (the one genuinely missing piece; ~40 lines in `useGridPersistence.ts`).
- Snapshot string → reused as the saved-team payload (zero new codecs).

Deliberately **not** done (over-engineering for current needs):

- No IndexedDB (localStorage volumes are trivial, §3.4); revisit only if thumbnails ever become stored images.
- No arbitrary-N UI (registry supports it; product doesn't need it yet — `MAX_GRID_COUNT` guard stays).
- No provenance/dirty-tracking between active team and library in v1 (§6 Q2/Q3).
- No new global event bus, no changes to drag & drop, uniqueness, phantimals, or skills — all verified count-agnostic.

One small cleanup **is** recommended while touching `TeamsView`: extract the `?g=`-vs-slot restore priority logic (currently inline, `TeamsView.vue:121-136`) into a small composable (`useTeamsRestore`) so the mode-switch path and the initial-load path share one restore implementation. This keeps the critical sequence (§3.3) in exactly one place.

---

## 5. Execution Plan

Four phases, each independently shippable and reviewable. After each phase: `npm run lint && npm run type-check && npm run test`.

### Phase 1 — Mode foundation (3v3 support, rename, per-mode persistence)

_Deliverable: Teams tab with a working 3v3 / 5v5 / 5v5 SL picker, independent per-mode state, wrap hidden for 3v3._

1. **Create `src/lib/teamModes.ts`** — registry as specified in §3.1 (types, `TEAM_MODES`, `DEFAULT_TEAM_MODE`, `isTeamModeKey`, `MAX_SAVED_TEAMS`).
2. **Rework `src/composables/useGridPersistence.ts`**:
   - Add `TEAMS_MODE_KEY = 'stargazer.teams.mode'`, slot helper `teamsSlotKey(mode)` = `stargazer.teams.active.<mode>`.
   - `useTeamsPersistence(mode: Ref<TeamModeKey>, getFlags)` returning `{ loadMode(), load(mode), flush(), setPaused(paused), startAutosave() }` per §3.3; keep `useArenaPersistence` untouched. This replaces the current stop-handle-less watch (`useGridPersistence.ts:57`) with a single pausable watcher keyed by the live mode ref — guard against double registration.
   - One-time migration `stargazer.teams` → `stargazer.teams.active.5v5sl` (run inside `load`, SSR-guarded).
3. **Update `src/utils/gridStateSerializer.ts`**: add `mode?: string` to `MultiGridState`; `serializeMultiGridState` gains an optional `mode` arg; add `resolveTeamMode(state): TeamModeKey` implementing §3.8 inference (this pure function lives here or in `teamModes.ts` — keep it next to the registry).
4. **Update `src/stores/urlState.ts`**: `restoreMultiFromEncodedState` unchanged in behavior but returns the decoded `mode` (via `resolveTeamMode`) in its result so callers can sync the picker.
5. **Rewire `src/views/TeamsView.vue`**:
   - Tab defs: `fiveVFive` key → `teams`, label `i18n.t('app.teams')`; delete `GRID_TABS` in favor of `activeMode = ref(DEFAULT_TEAM_MODE)` + `TEAM_MODES`.
   - Implement `switchMode(next)` exactly per §3.3 (extract shared restore into `useTeamsRestore` per §4); initial load order: migration → `?g=` (sets mode per payload) → `stargazer.teams.mode` slot → default mode. **Do not reuse the current count-equality rebuild check** (`TeamsView.vue:97`) for mode switches — see the §3.3 equal-count trap.
   - Wrap: pass `:can-wrap="!isSheet && TEAM_MODES[activeMode].canWrap"`.
6. **Create `src/components/teams/TeamModeControls.vue`** (mode picker only in this phase) and render it in `TeamsBoards.vue` above `GridControls`; segmented-control markup/styles per mock.
7. **Gate `BoardsRow` wrap CSS** on 5 slotted boards (it already no-ops for 3, since the `:nth-child(4)/(5)` selectors match nothing — verify, then just document it there).
8. **i18n**: add `mode-3v3.json`, `mode-5v5.json`, `mode-5v5-sl.json` (en + zh).
9. **Tests** (`tests/unit/`):
   - `lib/teamModes.test.ts`: registry invariants (`defaultMaps.length === boardCount`, all maps exist in `MAPS`, counts ≤ `MAX_GRID_COUNT`).
   - `composables/useGridPersistence.test.ts`: slot routing per mode; migration; pause semantics.
   - **The regression test**: build 5v5sl state → switch to 3v3 → assert 3v3 slot untouched & boards default → switch back → assert 5v5sl state restored byte-identical. This encodes the previous attempt's failure as a permanent guard.
   - `utils/gridStateSerializer.test.ts`: `mode` round-trip + `resolveTeamMode` inference table (3, 5, absent, crafted 2/4/7).

### Phase 2 — Saved Teams library (store, tab, Save button)

_Deliverable: Save button; Saved Teams roster tab with thumbnails, Select / Duplicate / Delete / rename._

1. **Create `src/stores/teamLibrary.ts`** per §3.4 (hydrate-once + mirror-on-change watch; cap enforcement; storage under `stargazer.teams.saved` `{ v: 1, teams }`; tolerate corrupt JSON by starting empty + console.warn). Note the page's restore/autosave block is gated on `gameDataStore.dataLoaded` (`TeamsView.vue:121`); library hydration itself is data-independent (it only stores strings), but Select must sit behind the same gate.
2. **Create `src/components/teams/TeamPreview.vue`** per §3.5 (props: `{ team: SavedTeam }`; decode memoized; per-board mini SVG via `Layout`/`Grid` + `getMapByKey`, fills copied from `ArenaPreviewGrid.getTileFill`, occupancy dots from `c`/`p` entries' hex ids).
3. **Create `src/components/teams/SavedTeamsList.vue`** per §3.9 (card grid, inline rename, two-step delete, empty state; emits `select(team)`).
4. **Wire selection**: `TeamsRoster` adds the `saved` tab (badge = count) and forwards `select` up to `TeamsView` (or calls a `useTeamSelection` composable that owns it) → run §3.4 Select semantics; collapse sheet on mobile.
5. **Extend `TeamModeControls`** with the Save button (+ new `src/components/ui/IconSave.vue`, styled like existing icon components).
6. **i18n**: `saved-teams.json`, `save.json`, `team-saved.json`, `team-loaded.json`, `team-deleted.json`, `duplicate.json`, `confirm.json`, `teams-limit.json`, `saved-teams-empty.json` (+zh). None of these basenames exist today (verified); basenames must stay unique across **both** `app/` and `app/messages/` — the loader flattens subfolders and warn-overwrites duplicates (`dataLoader.ts:255-279`).
7. **Tests**: `stores/teamLibrary.test.ts` (CRUD, cap, corrupt-storage hydration, duplicate naming); component test for select-overwrites-active flow if a harness exists (else cover via store-level integration test: save in 5v5sl → edit boards → select saved → boards restored).

### Phase 3 — Export / import

1. **`teamLibrary.exportAll` + UI**: serialize `{ app, kind, version, exportedAt, teams }`, `downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), timestampedName('stargazer-teams', 'json'))`.
2. **`teamLibrary.importTeams` + UI**: file input in `TeamModeControls`, following the WandWars records pattern (hidden `<input type="file" accept="application/json">` behind a visible button, `await file.text()`); validation pipeline per §3.7 → merge; result toast. Unit-test the validator exhaustively (bad envelope, bad mode, undecodable data, count mismatch, dup skip, cap overflow) — it is the only place untrusted file content enters the app.
3. **i18n**: `export.json`, `import.json`, `import-success.json`, `import-invalid.json` (+zh). Sentence-like toast strings go in the `src/locales/app/messages/` subfolder by convention (organization only — keys stay flat: `app.import-success`).

### Phase 4 — Polish & docs

1. `/share` wrap gating on `boards.length === 5` (cosmetic hardening — a 3-board wrap payload already degrades gracefully; verify, then decide if the line is worth it).
2. Docs: update `docs/architecture/GRID.md` (board array + modes), `URL_SERIALIZATION.md` (`mode` field, saved-team reuse of the codec), add `SAVED_TEAMS.md` if warranted; follow `STYLE_GUIDE.md`. Also fix the misleading comment at `gridStateSerializer.ts:161-162` ("tile states carry only the edits" — they carry every non-default tile including the map baseline).
3. Sweep: `npm run prep` (format + type-check + lint + test), manual pass over the QA checklist below.

### QA checklist (manual)

- [ ] 5v5sl edits → 3v3 → clean slate → back → edits intact (desktop + mobile)
- [ ] Reload restores last mode and its state; first-ever visit lands on 5v5 SL defaults
- [ ] Legacy `stargazer.teams` from production migrates into 5v5 SL on first visit
- [ ] Old (pre-feature) share links open correctly and select 5v5 SL
- [ ] New share link from 3v3 → `/share` shows 3 boards, no wrap artifacts; Edit pencil lands on `/teams` in 3v3 with payload applied
- [ ] `?g=` overwrite semantics per mode; invalid `?g=` → error toast + saved state intact
- [ ] Save/Select/Duplicate/Delete/rename; select from another mode switches the picker
- [ ] Export → clear browser storage → import → library identical
- [ ] Wrap toggle absent in 3v3; wrap flag round-trips for 5-board modes
- [ ] Cross-board drag, page-wide uniqueness, swap, team view, invert — unchanged in 3v3 (3 boards)
- [ ] Private-mode/quota-disabled storage: page functional, saves silently skipped, Save shows error toast

---

## 6. Open Questions (please answer at next session)

1. **"Edit" control**: your first list said _Edit, Delete, Duplicate_, the detailed list said _Select, Delete, Duplicate_. I designed **Select** (load as active) + **inline rename** on the card. Is that what "Edit" meant, or did you want a separate edit affordance?
2. **Save semantics**: v1 makes every Save a _new_ snapshot (no silent overwrite of the team you loaded). OK, or do you want Save to _update_ the loaded team (requires tracking provenance + an explicit "Save as new" secondary action)?
3. **Overwrite guard**: selecting a saved team overwrites the active team without confirmation (per your spec; a toast confirms). Fine, or add a confirm when the active team differs from every saved team (needs dirty-tracking)?
4. **Mode memory**: I persist the last-used mode (`stargazer.teams.mode`) so `/teams` reopens where you left off. Default for a first visit is 5v5 Supreme League (your stated default). Confirm both.
5. **Cap**: `MAX_SAVED_TEAMS = 50` (soft, with toast; technically ~1000s would fit). OK?
6. **Naming**: auto-name `Team N` + inline rename, no save dialog. OK?
7. **Thumbnails**: v1 = mini map SVG + team-colored occupancy dots (no character portraits). OK?
8. **Import policy**: merge + skip exact duplicates + fresh ids (never replaces the library). Want a "replace all" option too?
9. **5v5 (plain) maps**: you specified Arena 1 for all boards in both 3v3 and 5v5. Note the current 5v5 tab becomes "5v5 Supreme League" with its custom map list — the _plain_ 5v5 mode is new. Confirm the three-mode set and their labels (`3v3` / `5v5` / `5v5 Supreme League`).
10. **Export scope**: Export currently = _all_ saved teams (backup use-case). Per-team export/share can ride on `/share?g=` later. OK for v1?

---

## Appendix A — File touch list

| File                                        | Phase | Change                                                     |
| ------------------------------------------- | ----- | ---------------------------------------------------------- |
| `src/lib/teamModes.ts`                      | 1     | **new** — mode registry, `resolveTeamMode`, caps           |
| `src/composables/useGridPersistence.ts`     | 1     | per-mode slots, pause/flush, migration                     |
| `src/utils/gridStateSerializer.ts`          | 1     | `MultiGridState.mode?`                                     |
| `src/stores/urlState.ts`                    | 1     | return resolved mode from multi-restore                    |
| `src/views/TeamsView.vue`                   | 1     | tab rename, `activeMode`, switch sequence, `?g=` mode sync |
| `src/components/teams/TeamsBoards.vue`      | 1–2   | render `TeamModeControls`; wrap gating                     |
| `src/components/teams/TeamModeControls.vue` | 1–3   | **new** — picker; then Save; then Export/Import            |
| `src/components/teams/BoardsRow.vue`        | 1     | verify/document 3-board no-op of wrap CSS                  |
| `src/stores/teamLibrary.ts`                 | 2–3   | **new** — library CRUD + import/export                     |
| `src/components/teams/TeamPreview.vue`      | 2     | **new** — SVG thumbnail                                    |
| `src/components/teams/SavedTeamsList.vue`   | 2     | **new** — cards + actions                                  |
| `src/components/teams/TeamsRoster.vue`      | 2     | fourth tab (`saved`, badge)                                |
| `src/components/ui/IconSave.vue`            | 2     | **new**                                                    |
| `src/locales/app/*.json`                    | 1–3   | ~14 new keys (en + zh)                                     |
| `src/views/ShareView.vue`                   | 4     | wrap gating for non-5-board payloads                       |
| `tests/unit/…`                              | 1–3   | new suites per phase; regression test §5-P1-9              |
| `docs/architecture/…`                       | 4     | GRID.md, URL_SERIALIZATION.md updates                      |

## Appendix B — localStorage schema after this design

```
stargazer.arena                     (unchanged) binary-encoded Arena state
stargazer.teams.mode                '3v3' | '5v5' | '5v5sl'
stargazer.teams.active.3v3          encoded MultiGridState
stargazer.teams.active.5v5          encoded MultiGridState
stargazer.teams.active.5v5sl        encoded MultiGridState   (migrated from stargazer.teams)
stargazer.teams.saved               { v: 1, teams: SavedTeam[] }
```
