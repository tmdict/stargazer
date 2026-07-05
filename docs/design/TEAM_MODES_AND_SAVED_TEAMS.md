# Design: Team Modes (N-Grid) & Saved Teams

> **Status**: Rev 5 — **implemented** (all four phases + post-review refinements, on this branch); §8 is the implementation report. Rev 3 was the audited pre-implementation design.
> **Rev 5 changes** (post-implementation review Q&A): active slots carry a default-maps fingerprint — updating a mode's default list hard-resets that mode's active boards (saved teams untouched); serialized `t` recognized as authoritative — unknown/retired map keys no longer reject records, and thumbnails render from the record's `t` instead of the map config.
> **Scope**: Teams page (`/teams`) only. The Arena (`/`), Map Editor behavior, and WandWars are untouched (the Map Editor's preset picker shares the refactored preview component, §3.5, with identical rendering).
> **Companion mocks**: [`mocks/saved-teams-tab.html`](./mocks/saved-teams-tab.html), [`mocks/team-mode-controls.html`](./mocks/team-mode-controls.html)
> **Rev 3 changes** (from the persona audit, §6): canonical team data (view-state stripped) fixes the dirty-check and import round-trip; `?g=` mode/count contradiction + padding rules implemented via `normalizeTeamPayload`; lazy mount + rendering budget for the Saved Teams panel; single-rebuild switch sequence; store/toast layering fix; `sourceId` self-heal; virgin-mode flag policy; hydration/version policy; multi-tab decision; test-harness constraints; Appendix C (rejected alternatives).
> **Rev 2 changes**: all Rev 1 open questions resolved (§7); 1v1 mode; Save-updates / Save-as-New with provenance + unsaved-changes indicator; named saves (≤ 60 chars); cap 200; shared `BoardThumbnail` renderer with hero portraits; Delete-all; `src/lib/teams/` layout; legacy migration dropped.

## Overview

This design generalizes the 5v5 tab into a **Teams** tab that supports a configurable number of boards ("team modes": 1v1, 3v3, 5v5, 5v5 Supreme League), with fully independent persisted state per mode. On top of that it adds a **Saved Teams** library: named snapshots of any N-grid team that can be selected, updated, duplicated, deleted, exported to JSON, and imported back.

Both features reuse the existing multi-grid serialization codec (`MultiGridState`) as the snapshot format — the same string that powers share links and localStorage autosave becomes the unit of "a saved team" (in a **canonical, view-state-free form**, §3.4).

---

## 1. Current Architecture (Investigation Findings)

Everything below was verified against the current `main` (`0dc6101`), and re-verified independently during the Rev 3 audit.

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

- **Snapshot format**: `MultiGridState = { boards: BoardState[], active?, d? }` where `BoardState = GridState & { m?: string }` (per-board map key). It is **already count-agnostic** — `boards` is an array (`gridStateSerializer.ts:163-171`). Note `serializeMultiGridState` embeds the **active board index** and the **packed display flags** (`gridStateSerializer.ts:192-193`) — i.e. viewer state travels inside the snapshot; §3.4 defines a canonical form without it.
- **Encoding**: URL-safe base64 of JSON (`encodeMultiGridStateToUrl`, `urlStateManager.ts:33-35`). The single-board Arena uses a separate binary codec; multi-board deliberately does not (`urlStateManager.ts:30-32`).
- **localStorage**: `useGridPersistence.ts` writes the _same encoded string_ a share link carries to fixed keys: `stargazer.arena`, `stargazer.teams`. Autosave = one immediate write + a `watch` on the encoded snapshot (`useGridPersistence.ts:50-59`). All reads/writes are SSR-guarded and quota-tolerant (best-effort try/catch).
- **Restore**: `useUrlStateStore.restoreMultiFromEncodedState` (`urlState.ts:194-226`) decodes, clamps `boards.slice(0, MAX_GRID_COUNT)`, calls `setGridCount(boards.length, maps)` — **exactly the payload's count, no padding** — applies each board by temporarily making it active, then `dedupeCharacters()` repairs page-wide uniqueness against crafted URLs.
- **Priority**: on `/teams` load, `?g=` wins over the saved slot; a failed decode falls back to the slot; `startAutosave()`'s initial write is what commits the `?g=` payload over the slot (`TeamsView.vue:121-136`). The autosave watch has no stop/dispose handle — it lives until the page's setup scope dies.
- **Measured sizes** (ran the repo's own encoder): a fully-populated board ≈ 460 JSON bytes ≈ 612 encoded chars; a full 5-board team ≈ **3,060 encoded chars (~6 KB as UTF-16 in localStorage)**; an empty 5-board slate ≈ 126 chars. Note `t` is not edits-only — it re-emits the map's baseline available tiles (~26 entries/board), because restore resets all tiles to `DEFAULT` then replays `t`; the per-board `m` key mainly keeps `currentMap` honest for UI highlight.
- **No versioning anywhere**: neither codec has a version field; the de-facto strategy is additive evolution + graceful decode failure (null → treated as absent). Any new persistent structure should carry an explicit version from day one.
- **Existing bug this design fixes**: a crafted 3-board `/teams?g=` link _today_ rebuilds to 3 boards under the 5v5 tab, and the immediate autosave persists those 3 boards into `stargazer.teams` — silently destroying the 5-board save. Mode-routed restore/persist (§3.8) makes this impossible.
- **Share flow**: Link button → copies `/share?g=<encoded>` and navigates to the read-only `ShareView`; its Edit pencil deep-links to `/teams?g=<encoded>` (`ShareView.vue:118-121`), which is exactly the "overwrite active grids" semantic requested.

### 1.4 The roster panel and its tabs

`TeamsRoster.vue` renders a `TabView` with `characters` / `seasonal` / `maps` tabs inside a `BottomSheet` (desktop card / mobile pull-up sheet). The roster `TabView` is **`eager`** — every panel mounts at page load and inactive ones hide via `v-show` (`TabView.vue:45-57`); §3.9's rendering budget exists because of this. The Maps tab is `ArenaPreviewGrid`, which renders **each map as a small inline SVG of hex polygons** (`ArenaPreviewGrid.vue:22-38`). The guide pages have a richer variant, `GridSnippet.vue`, which additionally renders **hero portraits as SVG `<image>` elements clipped to hex shapes** (`GridSnippet.vue:180-205`). Together these are the in-repo precedent the thumbnail design consolidates (§3.5). Map selection calls `gridStore.switchMap(mapKey)` on the _active_ board.

### 1.5 Why the previous 3v3 tab failed (reconstruction)

Git history has been squashed ("clean up" commits), so the buggy attempt itself is gone, but the failure is fully explained by the current structure:

1. **One board array** — both tabs render `v-for ctx in grids.contexts`; with `TabView eager` both panels are mounted at once and literally show the same boards.
2. **One storage slot** — both tabs' autosaves write `stargazer.teams`. Switching tab rebuilds the array (`setGridCount`), the autosave watcher fires on the new (empty or differently-sized) snapshot, and **overwrites the other mode's save**.
3. **Rebuild-on-switch races** — `watch(activeTab)` only rebuilds when counts differ; restore, autosave start, and flag application are interleaved at page level and were never designed to be re-entrant per tab.

**Design conclusion:** the bug class disappears when (a) _mode is data, not a tab_ — a single owner (one panel, one watcher, one persistence pipeline) reconfigures the one board array, and (b) _each mode has its own storage slot_ with an explicit, ordered switch sequence (flush → rebuild → restore → resume autosave). That is exactly what §3 specifies.

### 1.6 Misc facts the design depends on

- i18n: one JSON file per key in `src/locales/app/` with `{ "en": …, "zh": … }` values; `app.teams` ("Teams"/"阵容") already exists. Basenames must be unique across `app/` and `app/messages/` (loader flattens subfolders and warn-overwrites duplicates, `dataLoader.ts:255-279`).
- Export precedent: `downloadBlob` + `timestampedName` (`src/utils/download.ts`); toasts via `useToast`. File-import precedent: WandWars records (`WandWarsView.vue:186` area) — export via `downloadBlob(new Blob([...], { type: 'text/plain' }))`, import via a hidden `<input type="file">` behind a button + `await file.text()` + per-entry validation with invalid entries dropped, **result surfaced by the calling component, not a store** — exactly the shape §3.7 needs. There is no confirm-dialog precedent (destructive actions like Clear act immediately; `BaseModal` is a dark glass overlay that would clash on the cream card).
- Icons are per-glyph SFCs (`src/components/ui/Icon*.vue`, feather-style, `currentColor`): `IconTrash` = delete, `IconCopy` = duplicate, `IconDownload` = export, `IconEdit` = rename already exist; only Save (and optionally an upload/import glyph) are new.
- Character portraits: `loadCharacterImages()` (`dataLoader.ts:88-102`) provides `Record<name, url>` (100×135 webp, bottom-fit); `gameDataStore.getCharacterById(id)` resolves id → `CharacterType` (name), `gameDataStore.getCharacterImage(name)` resolves name → url. `GridSnippet.vue` shows the SVG clip-path portrait technique. `FULL_GRID` is 45 hexes per board (`src/lib/types/grid.ts`).
- `/teams` is not SSG pre-rendered (SPA-only route; Netlify `_redirects` SPA fallback preserves `?g=`), and all storage code is SSR-guarded, so no new constraints.
- Tests live in `tests/unit/**` mirroring `src/` (existing suites for `grids`, `urlState`, `gridStateSerializer`, `urlStateManager`) and run via `vitest` **in the node environment — no jsdom, no `@vue/test-utils`** (§5 harness constraints).

---

## 2. Decision: How to Present Modes — Resolved

**Decision (confirmed): Option B — a mode control inside a single, generic "Teams" tab.**

|                                   | Option A: sibling tab per mode                                                            | Option B: mode control in one "Teams" tab                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Fit with existing code            | Duplicates panel wiring; two writers to one global board array (the prior bug class)      | `GRID_TABS` record becomes a mode registry; still exactly one writer           |
| Extensibility (2-grid, 4-grid, …) | New tab + panel each time                                                                 | One registry entry                                                             |
| Saved teams fit                   | A saved team's mode ≠ visible tab → awkward                                               | Mode is part of team identity; selecting a team just switches the mode control |
| Mobile                            | Tab strip would appear on mobile for the first time (today it's hidden, `TabList.vue:26`) | One tab; the mode picker is a compact segmented control                        |
| Risk                              | Re-introduces the eager-mounted shared-instance problem                                   | Bug class structurally removed                                                 |

**Four modes** (1v1 added per review): the segmented control reads `1v1 · 3v3 · 5v5 · 5v5 Supreme League`. Alternatives considered for crowding (dropdown, two-row chips): rejected — four short labels fit a single segmented control on desktop, and on mobile the segments wrap naturally in the controls column; a dropdown would hide the available modes and add a tap. Revisit only if the mode list grows past ~5.

**Tab rename**: the outer tab `5 v 5` → **Teams** (reuse existing `app.teams` key; the `fiveVFive` slot key is referenced only in `TeamsView.vue` + one comment — verified, minimal blast radius). The Image Stitcher tab is unchanged.

---

## 3. High-Level Design

### 3.0 Code layout (`src/lib/teams/`)

All new non-UI logic lives in a dedicated **`src/lib/teams/`** folder. UI stays where the repo's conventions put it:

| Layer       | Location                                                                                     | Contents                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Pure lib    | `src/lib/teams/modes.ts`                                                                     | mode registry, `resolveTeamMode`, `normalizeTeamPayload`, constants                      |
| Pure lib    | `src/lib/teams/savedTeam.ts`                                                                 | `SavedTeam` type, name rules, record validation, `canonicalTeamData`                     |
| Pure lib    | `src/lib/teams/transfer.ts`                                                                  | export envelope build + import validation (pure, exhaustively unit-testable)             |
| Pinia store | `src/stores/teamLibrary.ts`                                                                  | thin reactive wrapper: state + persistence; **returns typed results — no toasts** (§3.4) |
| Composables | `src/composables/useGridPersistence.ts` (rework), `src/composables/useTeamsRestore.ts` (new) | per-mode slots, restore/switch orchestration; **toasts live here or in components**      |
| Components  | `src/components/teams/*`, `src/components/grid/BoardThumbnail.vue`                           | UI                                                                                       |

This respects the documented layering rule (composables may call stores; **stores must never call composables** — so `useToast` is invoked by callers, never by `teamLibrary`; lib imports neither).

### 3.1 Team mode registry

`src/lib/teams/modes.ts` — the single source of truth for modes (replaces `GRID_TABS`):

```ts
export type TeamModeKey = '1v1' | '3v3' | '5v5' | '5v5sl'

export interface TeamModeConfig {
  key: TeamModeKey
  labelKey: string // i18n key for the mode picker
  boardCount: number
  defaultMaps: string[] // length === boardCount
  canWrap: boolean // wrap layout only makes sense for 5-board modes
}

const arena1 = (n: number): string[] => Array(n).fill('arena1')

export const TEAM_MODES: Record<TeamModeKey, TeamModeConfig> = {
  '1v1': {
    key: '1v1',
    labelKey: 'app.mode-1v1',
    boardCount: 1,
    defaultMaps: arena1(1),
    canWrap: false,
  },
  '3v3': {
    key: '3v3',
    labelKey: 'app.mode-3v3',
    boardCount: 3,
    defaultMaps: arena1(3),
    canWrap: false,
  },
  '5v5': {
    key: '5v5',
    labelKey: 'app.mode-5v5',
    boardCount: 5,
    defaultMaps: arena1(5),
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

export const TEAM_MODE_ORDER: TeamModeKey[] = ['1v1', '3v3', '5v5', '5v5sl']
export const DEFAULT_TEAM_MODE: TeamModeKey = '5v5sl'
export const MAX_SAVED_TEAMS = 200
export const MAX_TEAM_NAME_LENGTH = 60
export const isTeamModeKey = (k: unknown): k is TeamModeKey =>
  typeof k === 'string' && k in TEAM_MODES

// Mode for a decoded MultiGridState. A present `mode` is honored ONLY when
// boards.length === TEAM_MODES[mode].boardCount; a contradictory or unknown mode
// is treated as absent (fall through to count inference). Inference: 5 boards →
// '5v5sl' (all mode-less 5-board links predate the field and are today's SL page);
// otherwise the first mode in TEAM_MODE_ORDER with boardCount >= boards.length.
export function resolveTeamMode(state: MultiGridState): TeamModeKey

// Normalize a decoded payload to its resolved mode's shape: truncate boards to
// boardCount, or pad with empty boards `{ m: defaultMaps[i] }`. Teams-page ingress
// only (§3.8) — /share stays lenient and renders payloads as-is.
export function normalizeTeamPayload(state: MultiGridState, mode: TeamModeKey): MultiGridState
```

Notes:

- `MAX_GRID_COUNT` stays 5 and stays the clamp for crafted URLs.
- 1v1 gets the full Teams treatment (mode slot, saved teams, share links). It coexists with the Arena home page: the Arena remains the free-form single-board editor with its own binary codec and `stargazer.arena` slot; teams-page 1v1 is "a saved-able one-board team" using the multi codec. No interaction between the two.
- **Modes are add-only.** Removing a mode key requires a written migration for slots/library/exports referencing it — recorded here so it is a conscious act, not an accident (§3.4 hydration policy is the safety net).
- Adding a future mode = one entry here + one i18n file. Nothing else.

### 3.2 Per-mode active team state (localStorage)

Clean-slate schema (**no legacy migration**: the old `stargazer.teams` key is deleted unread; pre-existing autosaves are not carried over):

| Key                                | Content                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `stargazer.arena`                  | unchanged (Arena binary-encoded string)                               |
| `stargazer.teams.mode`             | last selected `TeamModeKey`                                           |
| `stargazer.teams.active.<modeKey>` | **`ActiveSlot` envelope** (below) — the mode's active team, autosaved |
| `stargazer.teams.saved`            | the saved-teams library: `{ v: 1, teams: SavedTeam[] }` (§3.4)        |

```ts
// stargazer.teams.active.<mode> — versioned from day one
interface ActiveSlot {
  v: 1
  data: string // encoded MultiGridState (full snapshot incl. view state — this is the autosave)
  sourceId: string | null // SavedTeam.id this active team was loaded from / last saved to
}
```

The envelope exists because Save-updates-selected (§3.4) needs **provenance**: the active team must remember which saved team it belongs to.

- **`sourceId` self-heal**: on slot adoption (§3.3 step 5), a `sourceId` that does not resolve in the library is normalized to `null` before the baseline write — covering deletes made while another mode was active, Delete all, cross-tab deletes, and library restores from backup. The rule everywhere is `source ≡ library.get(sourceId) ?? null`; label, dirty, and Save all derive from the resolved source.
- **Version policy**: an envelope (or library blob) whose `v` is not a known version is treated as absent (slot) / empty (library) — never shape-read. A slot that fails `JSON.parse` or whose `data` fails decode is likewise treated as absent.
- **Multi-tab**: out of scope, last-writer-wins per key, no `storage` event handling — this is a single-user tool and cross-tab sync isn't worth the complexity. Store actions perform read-modify-write against the freshly-read stored array (rather than trusting the in-memory copy) to narrow the clobber window cheaply; that is the full extent of v1's concession. Recorded so implementation doesn't relitigate.

On first visit after deploy, all keys are absent → the page opens on `DEFAULT_TEAM_MODE` with default boards.

### 3.3 The mode switch sequence (the critical invariant)

`useGridPersistence.ts` gains a mode-aware Teams persistence with an explicit pause + flush, replacing the single-slot `useTeamsPersistence`:

```ts
// sketch — useTeamsPersistence(modeKey: Ref<TeamModeKey>, sourceId: Ref<string | null>, getFlags)
const paused = ref(false)
const keyFor = (m: TeamModeKey) => `stargazer.teams.active.${m}`
// snapshot() = encodeMultiGridStateToUrl(serializeMultiGridState(...)) as today
watch([snapshot, sourceId], ([encoded, src]) => {
  if (!paused.value)
    writeSlot(keyFor(modeKey.value), JSON.stringify({ v: 1, data: encoded, sourceId: src }))
}) // default (pre) flush — see semantics note below
```

**Watcher flush semantics (pinned):** the watcher keeps Vue's default `pre` flush, matching today's autosave. Because every step of the switch sequence below is synchronous, the watcher callback runs once, _after_ the whole sequence, when `modeKey`/`snapshot`/`paused` already hold the new mode's values — so correctness of the final state does not depend on the pause flag today. The pause flag is **mandatory defense-in-depth**: it is what keeps the sequence safe if any step ever becomes async (a `nextTick`, a dynamic import) or the flush mode changes. Do not remove it as dead code, and do not switch to `flush: 'sync'` (that would run encode+write on every intermediate mutation of a restore). The Phase 1 regression test asserts, via write spies, that **no write to the old mode's key occurs after step 2 and no write to the new mode's key occurs before step 7**.

`TeamsView` owns `activeMode = ref<TeamModeKey>(…)`; `useTeamsRestore` performs every switch in this exact order:

1. `paused = true`
2. flush: write current snapshot → `keyFor(oldMode)` _(normally a no-op — autosave already mirrored it)_
3. `activeMode = newMode`; persist `stargazer.teams.mode`
4. **restore-or-default (single rebuild)**: read + decode `keyFor(newMode)`. If the slot yields a decodable payload → `restoreMultiFromEncodedState(slot.data)` (which itself rebuilds the board array to the payload's shape — that internal `setGridCount` is part of this orchestrated path, not a second writer). Otherwise → `grids.setGridCount(cfg.boardCount, cfg.defaultMaps)` for a fresh slate. Either way: `clearTargetHex()`; `clearLiftedHex()`.
5. adopt `sourceId` from the slot envelope, **normalized through the self-heal rule** (§3.2): unresolvable → `null`
6. display flags: if the slot's payload carried `d`, apply its flags; a **virgin mode keeps the current page flags** (flags are viewer preferences, and carrying them matches how the page already treats them as page-level state — they get baked into the new slot's baseline, which is fine). Then, if `!TEAM_MODES[newMode].canWrap`, force `wrapBoards = false`. Re-assert `hexSizeMode = 'fixed-medium'` + `applySize()` (the sizing the tab watcher pins today, `TeamsView.vue:102-103` — cheap, and keeps the sequence self-contained).
7. `paused = false`; write one baseline snapshot to `keyFor(newMode)`

This ordering is what makes "edit 5v5 → switch to 3v3 (clean slate) → switch back (edits intact)" hold by construction: a mode's slot is only ever written while that mode's boards are live. **A dedicated regression test for this sequence is part of Phase 1** (§5) — it is the exact failure of the previous attempt.

> ⚠️ **Equal-count trap**: today's tab watcher skips the rebuild when the target count equals `contexts.length` (`TeamsView.vue:97`) — an optimization for the Image Stitcher round-trip. A mode switch must **not** inherit that check: `5v5 → 5v5sl` keeps the count at 5 but changes maps and state, so step 4 always rebuilds (via restore or via defaults). (Toggling to the Image Stitcher tab and back is not a mode switch and still leaves boards untouched.)

Two details of the sequence, verified against current behavior:

- **`activeId` is not reset by `setGridCount` when still in range** (`grids.ts:101`) — switching 5v5 (active board 2) → 3v3 keeps board 2 active; the restore then applies the snapshot's own `active` field. Don't assume a reset.
- **Corrupt-slot asymmetry (existing behavior, inherited)**: a bad `?g=` preserves the saved slot (decode failure → fallback), but a corrupt _slot_ is overwritten with fresh defaults by the baseline write. Acceptable (the slot was unreadable anyway), but worth knowing when debugging.

Nothing about `useGrids`, `GridContext`, drag & drop, uniqueness rules, or skills changes: they are already count-agnostic (`contexts.length` is the only truth they read).

### 3.4 Saved Teams library

Types and rules in `src/lib/teams/savedTeam.ts`; reactive store in `src/stores/teamLibrary.ts`:

```ts
export interface SavedTeam {
  id: string // crypto.randomUUID()
  name: string // 1..60 chars (MAX_TEAM_NAME_LENGTH), trimmed
  mode: TeamModeKey
  data: string // CANONICAL encoded MultiGridState (see below)
  createdAt: number // epoch ms
  updatedAt: number
}

// Canonical team data: decode → drop `active` and `d` (viewer state) → re-encode
// through this serializer. Team CONTENT only: boards + mode. One function, used by
// Save, Save as New, Duplicate, Import, and the dirty compare — so equal content
// is always byte-equal.
export function canonicalTeamData(encoded: string): string | null // null = undecodable

// stored under 'stargazer.teams.saved' as { v: 1, teams: SavedTeam[] }

export const useTeamLibrary = defineStore('teamLibrary', () => {
  const teams = ref<SavedTeam[]>([]) // hydrated once from storage; mutations do read-modify-write (§3.2)
  const get = (id: string) => SavedTeam | undefined
  const saveAsNew = (mode, data, name) => SavedTeam | null // null when at cap
  const update = (id, data) => boolean // updates data + updatedAt; keeps name/createdAt
  const remove = (id) => void
  const removeAll = () => void
  const duplicate = (id) => SavedTeam | null // "<name> (copy)" trimmed to 60, fresh id, at-cap guarded
  const rename = (id, name) => void // trimmed, clamped to 60, non-empty
  const exportAll = () => TeamsExportFile
  const importTeams = (raw: string) => { imported: number; skipped: number; error?: string }
})
// NOTE (layering): the store returns typed results and NEVER toasts — useToast is a
// composable and stores must not call composables. Calling components/composables
// own user feedback, same as the WandWars import precedent.
```

**Canonical data is the load-bearing idea** (from the audit): `serializeMultiGridState` embeds the active-board index and the packed display flags — viewer state, not team content. If saved teams stored raw snapshots, clicking a different board or toggling Flat would mark a just-saved team "dirty", Save would bake viewer state into the record, and imported records (different key order / missing fields) would never byte-match. Canonicalizing at every write **and** on the live side of the compare makes the dirty check trustworthy and import round-trip-stable.

Semantics (per resolved decisions):

- **Save** (primary): if the resolved source (§3.2 rule) exists, **update it in place** (`data = canonicalTeamData(activeEncoded)`, `updatedAt`; name and `createdAt` keep). Toast (from the caller): "Saved to ⟨name⟩". If the source is null, Save degrades to Save as New.
- **Save as New**: opens a lightweight name popover anchored to the button — a text input prefilled with the next auto-name (`Team N`), max 60 chars, Enter commits / Esc cancels (mock shows it). Creates the record (canonical data) and points the active slot's `sourceId` at it, so subsequent Saves update it.
- **Select** (on a card): loads the team into the active slot — switch `activeMode` to `team.mode` (full §3.3 sequence), apply `team.data` through the single restore path, set `sourceId = team.id`, baseline-write. Because canonical data carries no `d`, **Select applies board content only — the viewer's current display flags are untouched** (`useTeamsRestore` applies flags only when the payload has `d`; §3.8), and the active-board pointer resets to board 0 (restore's existing `multi.active ?? 0`). Overwrites that mode's current active team (per spec); toast "Team loaded". Selection from the mobile sheet collapses the sheet. Select sits behind the page's `gameDataStore.dataLoaded` gate.
- **Unsaved-changes indicator**: dirty ≡ `canonicalTeamData(activeEncoded) !== source.data`. Both sides canonical: the compare reflects **content** changes only — board clicks, Flat/Grid Info/Team View/wrap toggles, and viewport changes do not trip it. The live side is a memoized computed (decode+strip+re-encode of ≤ ~6 KB — trivial); the saved side is already canonical. The controls row shows the **active team label** — the resolved source's name, or "Unsaved team" — with a dot when dirty.
- **Delete** (per card): two-step inline confirm (button arms → "Confirm?" for ~3 s), no modal. If the deleted team is the active source, the boards are untouched and the label reverts to "Unsaved team" (the resolved source is now null); other modes' slots self-heal on their next adoption (§3.2).
- **Delete all** (tab header): same two-step confirm, clears the library. Complements merge-only import: "replace all" = Delete all + Import.
- **Duplicate**: copy with fresh id, name `"<name> (copy)"` clamped to 60.
- **Rename**: inline on the card (click name; Enter/blur commits, Esc cancels).
- **Hydration policy**: records failing per-record validation (same rules as import, §3.7 — including unknown `mode`) are dropped with a `console.warn`; a `v !== 1` library blob is treated as empty. Under the add-only mode rule (§3.1) this drop path should never fire for mode reasons in practice; it is the safety net, not the migration strategy.

**Why store the encoded string (not raw JSON)?** It reuses the exact codec + validation path of share links (`decodeMultiGridStateFromUrl` is the integrity check), keeps the library entries directly shareable (`/share?g=<data>` works verbatim — canonical data simply renders with `/share`'s defaults, enabling a per-team Share action later), and makes export/import trivially round-trippable.

**Size & limits**: **measured with the repo's own encoder**, a fully-populated 5-board team is ≈ 3,060 encoded chars ≈ **6 KB** as stored (localStorage is UTF-16); smaller modes proportionally less. `MAX_SAVED_TEAMS = 200` ≈ 1.2 MB worst-case against the typical ~5 MB/origin quota — safe, with headroom left for the rest of the app's keys. The cap is enforced in `saveAsNew`/`duplicate`/`importTeams`. The quota risk would only appear if thumbnails were ever _stored_ as images (20–100 KB+ each) — which §3.5 deliberately avoids. Quota errors are already handled as best-effort (silent catch) in the storage helpers; a failed explicit save additionally surfaces an error toast (from the caller).

### 3.5 Thumbnails — shared `BoardThumbnail` renderer with hero portraits

The repo has two hand-rolled SVG hex-board renderers today: `ArenaPreviewGrid.vue` (maps tab + Map Editor: polygons only) and `GridSnippet.vue` (guide pages: polygons **plus hero portraits** as `<image>` clipped to hex shapes, `GridSnippet.vue:180-205`). Per review, this design **extracts the shared capability** instead of adding a third copy:

**New `src/components/grid/BoardThumbnail.vue`** — a presentational SVG board renderer:

```ts
interface ThumbnailUnit {
  hexId: number
  team: Team
  image?: string // portrait URL; fallback renders a team-colored dot
}
defineProps<{
  mapKey: string // hex polygons + fills derived from getMapByKey (throwaway Grid, like ArenaPreviewGrid)
  units?: ThumbnailUnit[] // portraits clipped to hex + team-colored ring (GridSnippet technique)
  hexSize?: number // default sized for card thumbnails (~7px)
}>()
```

- **`TeamPreview.vue`** (saved-team card) decodes `team.data` once (memoized computed) and renders one `BoardThumbnail` per board: `mapKey` from `m`; `units` from `c` (characterId → `gameDataStore.getCharacterById(id)?.name` → `getCharacterImage(name)`) and `p` (phantimals → their icon via the same asset dictionaries, or dot fallback). The data→units mapping lives in `src/lib/teams/` so it is unit-testable headless. Corrupt records render a fallback tile with a warning glyph instead of breaking the list.
- **Portraits are v1**. Unresolvable ids (data from a future version, missing image) fall back to the team-colored dot, so a thumbnail never breaks.
- **Rendering budget** (audit-confirmed: `FULL_GRID` = 45 hexes/board → 200 teams × 5 boards ≈ 45,000 polygons if naive):
  - Hex geometry is computed **once at module level** (the polygon-points strings depend only on `FULL_GRID` + `hexSize`, identical for every board) — thumbnails share it instead of recomputing per instance.
  - `clipPath` defs are emitted **only for occupied hexes** (units), not all 45 (GridSnippet emits one per hex — don't copy that).
  - Cards get `content-visibility: auto` + `contain-intrinsic-size` so offscreen cards skip layout/paint; opening the tab renders roughly a screenful.
  - The panel itself mounts lazily (§3.9).
- **`ArenaPreviewGrid` is refactored to render through `BoardThumbnail`** (no `units`), keeping its own card chrome/selection ring. This changes the shared component under the **Map Editor's** preset picker too — behavior identical, and the QA checklist pixel-checks both consumers.
- **`GridSnippet` stays as-is** for now — it has guide-specific features (highlight groups, numeric labels, imaginary hexes) and name-keyed configs; converging it onto `BoardThumbnail` is a follow-up. Noted so the third copy doesn't proliferate further.
- Thumbnails render the map baseline from `m`; `t` divergence (possible only via hand-crafted imports) is intentionally not rendered — the Select path remains the source of truth.
- The DOM-capture path (`useGridExport` / html-to-image) is **not** viable for thumbnails: it only captures mounted DOM, and saved teams are by definition not the live boards. Data→SVG is the only correct source, and nothing image-like is ever stored.

### 3.6 New controls row (TeamModeControls)

New component `src/components/teams/TeamModeControls.vue`, rendered by `TeamsBoards.vue` **above** the existing `GridControls` row:

- **Mode picker** — segmented control: `1v1 · 3v3 · 5v5 · 5v5 Supreme League` (from `TEAM_MODES`/`TEAM_MODE_ORDER`). Switching is instant and lossless (each mode keeps its own state), so no confirmation is needed.
- **Active team label** — the resolved source's name (or "Unsaved team"), with the unsaved-changes dot (§3.4). Read-only in v1 (rename lives on the card).
- **Save** — primary button; updates the source team, or degrades to Save as New when there is none (§3.4).
- **Save as New** — secondary button; opens the name popover (§3.4).
- **Export** — downloads all saved teams as JSON (§3.7).
- **Import** — hidden `<input type="file" accept="application/json">` behind a button (§3.7).

Existing `GridControls` row changes: `show-wrap-toggle` becomes `canWrap && TEAM_MODES[activeMode].canWrap` — the Wrap toggle renders only for 5-board modes (`BoardsRow`'s wrap CSS already no-ops below 4 boards). Everything else (Flat, Grid Info, Team View, Skills, Targeting, Invert, Link, Copy, Download, Clear) is unchanged and applies to whatever boards are live.

Deferred (unchanged from Rev 1): Reset-team button (Clear covers most of it), per-team Share on cards (rides on `/share?g=<data>` when wanted).

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

Export's purpose is **backup**: it always contains the whole library.

Import validation (pure function in `src/lib/teams/transfer.ts`), in order: envelope shape (`app`/`kind`/`version` known) → per-record: `mode` passes `isTeamModeKey`, `name` is a non-empty string (trim, clamp 60), `data` decodes via `decodeMultiGridStateFromUrl`, `boards.length === TEAM_MODES[mode].boardCount`, **every board's `m` key exists in `MAPS`** (an unknown `m` would build the default layout while `currentMap` names a nonexistent map — a known footgun in `createGridContext`) → finally **`data` is canonicalized** (`canonicalTeamData`, §3.4) before storing, which simultaneously strips stray viewer state (`d`, `active`), normalizes key order, and guarantees the record byte-round-trips against the dirty compare. (Canonicalization also disposes of the missing-`d`/`showArrows`-defaults-true trap: canonical data never has `d`, and Select never applies flags from it.) Valid records are **merged** (never replace): fresh `id`s are assigned; records whose canonical `data` + `name` exactly match an existing team are skipped as duplicates; cap 200 enforced. Result toast (from the caller): "Imported N teams (M skipped)". A malformed file → error toast, library untouched. Import never touches the active boards. "Replace all" = Delete all (§3.4) + Import.

Deliberate non-goal: we do not deep-validate `t` tile entries against `m` (a hand-edited mismatch renders `t`'s layout — same lenient behavior as share URLs); duplicate heroes in hand-crafted data are handled by the existing restore-time repair (`dedupeCharacters`) when the team is _selected_, exactly like a crafted share URL.

### 3.8 URL serialization & share links

- `MultiGridState` gains an optional `mode?: TeamModeKey` field, **always written** by the serializer from now on; the decoder tolerates absence (no version bump needed — the format is self-describing JSON and existing links must keep decoding).
- **Mode resolution** (`resolveTeamMode`, §3.1): a present `mode` is honored only when it matches `boards.length`; contradictory/unknown/absent modes are inferred from the count (5 → `5v5sl`; else first mode with `boardCount ≥ boards.length`). **Count normalization** (`normalizeTeamPayload`, §3.1): the teams-page ingress (`useTeamsRestore`) decodes once, resolves the mode, normalizes the payload to the mode's exact board count (truncate, or pad with empty boards on the mode's default maps), re-encodes, and applies it through the single restore path — so a 2-board crafted link can never leave a 2-board array in the 3v3 slot. This closes the ingress asymmetry the audit found (import validated the count invariant; `?g=` didn't).
- `restoreMultiFromEncodedState`'s result gains **`hasDisplayFlags`** (`multi.d !== undefined`); callers apply display flags **only when true**. This is what lets canonical team data (no `d`) restore content without clobbering the viewer's flags — and it removes the existing quirk where a payload without `d` would apply `unpackDisplayFlags(undefined)` defaults (targeting arrows on).
- `/teams?g=<encoded>` → decode, resolve mode, normalize, **switch the mode picker to it**, and overwrite that mode's active slot with `sourceId = null` (a shared link is nobody's saved team). Decode failure → error toast → fall back to `stargazer.teams.mode` + its slot (existing priority logic generalizes unchanged).
- `/share` (read-only) needs no functional change and **stays lenient** — it renders `boards.length` boards exactly as the payload says (including 1-board multi payloads), with no normalization. A 3-board payload with the wrap bit set already degrades gracefully; the Phase-4 "gate wrap on `boards.length === 5`" item is cosmetic hardening only.
- **In-app navigation caveat**: today every entry into `/teams?g=` is a hard navigation (ShareView's Edit pencil is a plain `<a href>`), so the direct `window.location.search` read is always current. If a future feature navigates in-app (e.g. per-saved-team "open in editor" via `router.push`), it must read `getEncodedStateFromRoute` or force a reload — and note `?g=` is never stripped after restore, so a reload re-applies and re-overwrites (existing behavior).

### 3.9 Saved Teams tab (roster panel)

`TeamsRoster.vue` gains a fourth tab: `characters / seasonal / maps / saved` (label `app.saved-teams`, with a count badge via `TabItem.badge` — reactive through the existing `tabs` computed). Panel component `src/components/teams/SavedTeamsList.vue`:

- **Lazy mount**: the roster `TabView` is `eager` (all panels mount at page load, §1.4), which at the 200-team cap would create tens of thousands of SVG nodes for a tab the user may never open. The panel body is therefore gated on **first activation**: TabView already passes an `:active` scoped-slot prop (`TabView.vue:55`); `SavedTeamsList` uses a sticky `v-if` (mounts on first `active === true`, stays mounted after for scroll/rename state). Combined with §3.5's `content-visibility` budget, opening the tab lays out roughly a screenful of cards.
- Header row: count (`N / 200`), **Delete all** (two-step confirm), cap warning when ≥ 80% full.
- Responsive card grid; each card: `TeamPreview` thumbnail (portraits, §3.5), mode chip (`1v1` / `3v3` / `5v5` / `5v5 SL`), name (inline-editable), relative updated time, and actions **Select** / **Duplicate** / **Delete** — rendered at **equal width** (3-column grid within the card) with Select visually primary.
- Empty state: hint text pointing at the Save buttons.
- Selecting from the mobile sheet collapses the sheet (same pattern as character placement, `TeamsRoster.vue:44-51`).

See the HTML mock for the exact look.

### 3.10 Invariants the implementation must preserve

These are documented (GRID.md / ARCHITECTURE.md) or load-bearing behaviors; the design deliberately routes around all of them — an implementer must not "simplify" across them:

1. **Bulk state application goes through `restoreMultiFromEncodedState` — never a bespoke loader.** The existing path encapsulates non-obvious ordering: per-board apply via temporary `setActive`, companions settled per-main, `dedupeCharacters()` after _all_ boards (per-board checks can't see cross-board duplicates), `seedPhantimalBaseline()` last (phantimal auto-placement is edge-triggered; a restore must not read as a transition). Saved-team Select, `?g=` ingress, and mode-switch restore all reuse it and inherit this for free.
2. **Exactly one orchestrator initiates board-count changes on `/teams`**: `useTeamsRestore` (switch/Select/`?g=` ingress). `restoreMultiFromEncodedState`'s internal `setGridCount` is that orchestrator's delegated mechanism, not a second writer; components never call `setGridCount` directly.
3. **Mode switch always rebuilds; Image-Stitcher tab round-trip never rebuilds.** Two different semantics currently share one watcher (the §3.3 equal-count trap) — keep them as two separate code paths.
4. **`onScopeDispose` still resets to `setGridCount(1)` on leave** (Arena handoff, HMR-safe). Per-mode slots are already flushed by then because the autosave watcher was armed on the correct key the whole time (and effect scopes stop watchers before dispose callbacks run, so the leave-time reset is never autosaved).
5. **`MAX_GRID_COUNT = 5` clamps everything** (crafted URLs and imports must not build arbitrary board counts).
6. **Page-wide (character, team) and (artifact, team) uniqueness across boards** — never place around it; always go through the store APIs that enforce it.
7. **Display globals (`teamView`, `inverted`) are reset at page setup** so a first visit never inherits another page's toggles; a restored `inverted` flag only relabels — it must never re-trigger the unit mirror-swap.
8. **Selection state is board-qualified and boards share hex ids** — `clearTargetHex()` / `clearLiftedHex()` after every rebuild (§3.3 step 4).
9. **Layering rule** (ARCHITECTURE.md): composables may call stores; stores must never call composables; `src/lib/teams/*` imports neither. Concretely: `teamLibrary` returns typed results and never toasts (§3.4); orchestration lives in `useTeamsRestore`.
10. **`startAutosave`'s initial unconditional write is load-bearing** — it is what commits a `?g=` payload over the slot. Keep the order: restore first, then arm autosave (which writes the baseline).
11. **`source ≡ library.get(sourceId) ?? null`** — label, dirty, and Save derive from the resolved source only; unresolvable `sourceId`s are normalized to null at slot adoption (§3.2).
12. **All saved-team `data` is canonical** (`canonicalTeamData`) — every write path (Save, Save as New, Duplicate, Import) canonicalizes; the dirty compare canonicalizes its live side. No raw snapshot ever enters the library.

---

## 4. Architecture Assessment (refactor vs. bolt-on)

**No major refactor is needed — and that is a finding, not a compromise.** The codebase already has the shape a from-scratch design would choose: per-board state is encapsulated in `GridContext`, the collection + cross-board rules live in one store, the snapshot codec is count-agnostic, and the page already declares "modes as data" (`GRID_TABS`). The design therefore _completes_ existing seams rather than fighting them:

- `GRID_TABS` → `TEAM_MODES` registry (same idea, promoted to `src/lib/teams/` with types).
- Single teams storage slot → keyed slots + explicit switch protocol (the one genuinely missing piece).
- Snapshot string → reused as the saved-team payload, in canonical form (one new pure function, zero new codecs).
- Two hand-rolled SVG board renderers → one shared `BoardThumbnail` with two consumers (three when guides converge later).

Deliberately **not** done (over-engineering for current needs):

- No IndexedDB (localStorage volumes are trivial, §3.4); revisit only if thumbnails ever become stored images.
- No arbitrary-N UI (registry supports it; product doesn't need it yet — `MAX_GRID_COUNT` guard stays).
- No GridSnippet convergence in this feature (§3.5).
- No cross-tab `storage` sync (§3.2 — documented decision).
- No new global event bus, no changes to drag & drop, uniqueness, phantimals, or skills — all verified count-agnostic.

One small cleanup **is** included while touching `TeamsView`: extract the `?g=`-vs-slot restore priority logic (currently inline, `TeamsView.vue:121-136`) into `useTeamsRestore` so the mode-switch path, the saved-team Select path, and the initial-load path share one restore implementation. This keeps the critical sequence (§3.3) in exactly one place.

---

## 5. Execution Plan

Four phases, each independently shippable and reviewable. After each phase: `npm run lint && npm run type-check && npm run test`.

> **Test-harness constraints (pinned)**: vitest runs in the **node environment — no jsdom, no `@vue/test-utils`**. Everything the test plan below names must therefore be drivable headless: `localStorage` is stubbed (follow the existing store tests' pattern), the switch/Select orchestration is plain composable functions over Pinia stores (`createPinia` + `setActivePinia`), display-flag getters are parameterized functions, and the thumbnail data→units mapping lives in `src/lib/teams/` precisely so it tests without mounting a component. Slot-write assertions use spies on the storage helpers.

### Phase 1 — Mode foundation (1v1 + 3v3 support, rename, per-mode persistence)

_Deliverable: Teams tab with a working 1v1 / 3v3 / 5v5 / 5v5 SL picker, independent per-mode state, wrap hidden for non-5-board modes._

1. **Create `src/lib/teams/modes.ts`** — registry per §3.1 (types, `TEAM_MODES`, `TEAM_MODE_ORDER`, `DEFAULT_TEAM_MODE`, `MAX_SAVED_TEAMS`, `MAX_TEAM_NAME_LENGTH`, `isTeamModeKey`, `resolveTeamMode` with the contradiction rule, `normalizeTeamPayload`).
2. **Rework `src/composables/useGridPersistence.ts`**:
   - Add `TEAMS_MODE_KEY = 'stargazer.teams.mode'`, slot helper `teamsSlotKey(mode)`; `ActiveSlot` envelope read/write (versioned; unknown `v` → absent).
   - `useTeamsPersistence(mode, sourceId, getFlags)` returning `{ loadMode(), load(mode), flush(), setPaused(paused), startAutosave() }` per §3.3, **default (pre) flush + pause flag with the pinned semantics** — do not remove the pause as dead code; guard against double registration. Keep `useArenaPersistence` untouched.
   - Delete the legacy `stargazer.teams` key on init (no read, no migration).
3. **Update `src/utils/gridStateSerializer.ts`**: add `mode?: string` to `MultiGridState`; `serializeMultiGridState` gains a `mode` arg (always written).
4. **Update `src/stores/urlState.ts`**: `restoreMultiFromEncodedState` result gains the resolved `mode` and **`hasDisplayFlags`** (§3.8).
5. **Create `src/composables/useTeamsRestore.ts`** and **rewire `src/views/TeamsView.vue`**:
   - Tab defs: `fiveVFive` key → `teams`, label `i18n.t('app.teams')`; delete `GRID_TABS` in favor of `activeMode = ref(DEFAULT_TEAM_MODE)` + `TEAM_MODES`.
   - `switchMode(next)` exactly per §3.3 (restore-or-default single rebuild; `sourceId` self-heal; virgin-flag policy; wrap reset; hex-size re-assert). **Do not reuse the count-equality rebuild check** (`TeamsView.vue:97`) — §3.3 equal-count trap.
   - `?g=` ingress: decode → `resolveTeamMode` → `normalizeTeamPayload` → re-encode → apply via the single restore path, `sourceId = null`. Initial load order: `?g=` → `stargazer.teams.mode` + its slot → default mode. Apply display flags only when `hasDisplayFlags`.
   - Wrap: pass `:can-wrap="!isSheet && TEAM_MODES[activeMode].canWrap"`.
6. **Create `src/components/teams/TeamModeControls.vue`** (mode picker + active-team label placeholder in this phase) and render it in `TeamsBoards.vue` above `GridControls`; segmented-control markup/styles per mock.
7. **Verify `BoardsRow` wrap CSS** no-ops for 1 and 3 boards (the `:nth-child(4)/(5)` selectors match nothing — verify, then document in place).
8. **i18n**: `mode-1v1.json`, `mode-3v3.json`, `mode-5v5.json`, `mode-5v5-sl.json` (en + zh).
9. **Tests** (`tests/unit/`):
   - `lib/teams/modes.test.ts`: registry invariants (`defaultMaps.length === boardCount`, all maps exist in `MAPS`, counts ≤ `MAX_GRID_COUNT`); `resolveTeamMode` table (1/3/5 boards, absent mode, unknown mode, **contradictory mode+count**, crafted 2/4/7); `normalizeTeamPayload` (truncate, pad, pad-maps correctness).
   - `composables/useGridPersistence.test.ts`: slot routing per mode; envelope round-trip (incl. `sourceId`); corrupt/`v`-mismatch envelope → absent; pause semantics; legacy-key deletion.
   - **The regression test**: build 5v5sl state → switch to 3v3 → assert 3v3 slot untouched & boards default → switch back → assert 5v5sl state restored byte-identical; include the 5v5 ↔ 5v5sl equal-count case; **assert via write-spies that no old-key write occurs after flush and no new-key write occurs before the baseline** (§3.3).
   - `utils/gridStateSerializer.test.ts`: `mode` round-trip; `hasDisplayFlags` behavior.
   - Ingress test: crafted 2-board `?g=` → 3v3 mode, 3 boards (third on `arena1`), slot holds 3-board payload.

### Phase 2 — Saved Teams library (store, tab, Save/Save-as-New, thumbnails)

_Deliverable: Save + Save as New with provenance; Saved Teams roster tab with portrait thumbnails, Select / Duplicate / Delete / Delete all / rename._

1. **Create `src/lib/teams/savedTeam.ts`** (types; name normalization/clamping; auto-name `Team N`; duplicate naming; **`canonicalTeamData`**; per-record validation shared with import) and **`src/stores/teamLibrary.ts`** per §3.4 (hydrate-once with validation; read-modify-write mutations; cap 200; `{ v: 1, teams }`; corrupt/`v`-mismatch → empty + console.warn; **typed results, no toasts**).
2. **Create `src/components/grid/BoardThumbnail.vue`** per §3.5 (module-level shared hex geometry; clipPaths for occupied hexes only; portraits + dot fallback). **Refactor `ArenaPreviewGrid.vue` to render through it** (pixel-match; keep selection chrome; QA covers the Map Editor consumer too).
3. **Create `src/components/teams/TeamPreview.vue`** per §3.5 (decode memoized; data→units mapping from `lib/teams`; corrupt-record fallback tile).
4. **Create `src/components/teams/SavedTeamsList.vue`** per §3.9 (sticky-`v-if` lazy mount on first activation; header with count + Delete all; card grid with equal-width actions + `content-visibility: auto`; inline rename; two-step deletes; empty state; emits `select(team)`; toasts fired here).
5. **Wire selection + provenance**: `TeamsRoster` adds the `saved` tab (badge = count); Select flows through `useTeamsRestore` (sets `sourceId`, flags untouched per §3.4); collapse sheet on mobile.
6. **Extend `TeamModeControls`**: active-team label + dirty dot (canonical compare, memoized); Save (update-or-degrade) + Save as New with name popover (prefilled auto-name; Enter/Esc; 60-char clamp); toasts fired here. New `src/components/ui/IconSave.vue`; reuse `IconCopy`/`IconTrash`/`IconDownload`.
7. **i18n**: `saved-teams.json`, `save.json`, `save-as-new.json`, `team-name.json`, `unsaved-team.json`, `team-saved.json`, `team-loaded.json`, `team-deleted.json`, `delete-all.json`, `duplicate.json`, `confirm.json`, `teams-limit.json`, `saved-teams-empty.json` (+zh). Basenames verified unique across `app/` and `app/messages/`.
8. **Tests**: `lib/teams/savedTeam.test.ts` (naming rules, clamping, **canonicalTeamData: strips `d`/`active`, keeps `mode`, idempotent, byte-stable round-trip**); `stores/teamLibrary.test.ts` (CRUD incl. update/removeAll, cap 200, corrupt-storage + unknown-mode hydration drops, duplicate naming, read-modify-write); integration (store-level, headless): save-as-new → edit boards → dirty on → **click another board / toggle a display flag → dirty stays off for content-identical state** → Save updates source → Select another team switches mode + repoints `sourceId` → delete source (incl. **from another mode / Delete all**) → resolved source null, label "Unsaved team".

### Phase 3 — Export / import

1. **Create `src/lib/teams/transfer.ts`**: `buildExport(teams)` and `parseImport(raw)` as pure functions per §3.7 (validation pipeline ending in canonicalization).
2. **Wire export**: `downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), timestampedName('stargazer-teams', 'json'))`.
3. **Wire import**: hidden file input in `TeamModeControls` (WandWars pattern); `await file.text()` → `parseImport` → merge; result toast from the component.
4. **Tests**: exhaust `parseImport` (bad envelope, bad mode, undecodable data, count mismatch, unknown map key, name clamping, dup skip, cap overflow, **canonicalization: imported data round-trips to itself; a record with stray `d`/`active` is stored stripped and is not dirty after Select**) — it is the only place untrusted file content enters the app.
5. **i18n**: `export.json`, `import.json`, `import-success.json`, `import-invalid.json` (+zh).

### Phase 4 — Polish & docs

1. `/share` wrap gating on `boards.length === 5` (cosmetic hardening — verify, then decide if the line is worth it).
2. Docs: update `docs/architecture/GRID.md` (board array + modes), `URL_SERIALIZATION.md` (`mode` field, canonical saved-team reuse of the codec), add `SAVED_TEAMS.md` if warranted; follow `STYLE_GUIDE.md`. Also fix the misleading comment at `gridStateSerializer.ts:161-162` ("tile states carry only the edits" — they carry every non-default tile including the map baseline).
3. Sweep: `npm run prep` (format + type-check + lint + test), manual pass over the QA checklist below.

### QA checklist (manual)

- [ ] Edits in each of the four modes survive round-trips through every other mode (desktop + mobile)
- [ ] 5v5 ↔ 5v5sl switch (equal board count) rebuilds maps + state correctly
- [ ] Reload restores last mode and its state; first-ever visit lands on 5v5 SL defaults; old `stargazer.teams` key is removed and ignored
- [ ] Old (pre-feature) share links open correctly and select 5v5 SL
- [ ] Crafted short link (2 boards) → 3v3 with a padded third board on Arena I; slot holds 3 boards
- [ ] New share link from each mode → `/share` renders the right board count; Edit pencil lands on `/teams` in that mode with payload applied
- [ ] `?g=` overwrite semantics per mode (`sourceId` cleared); invalid `?g=` → error toast + saved state intact
- [ ] Save updates the source team; Save as New pops the name input (prefill, 60-char clamp, Enter/Esc); dirty dot appears on **content** edit only — board clicks and Flat/Grid Info/Team View/wrap toggles do **not** trip it — and clears on Save/Select
- [ ] Select applies team content without changing the current display toggles
- [ ] Select/Duplicate/Delete/Delete-all/rename; select from another mode switches the picker; deleting the source team (any mode, incl. Delete all) reverts the label to "Unsaved team" after switch-back
- [ ] Thumbnails show portraits on the right hexes/teams; corrupt record falls back gracefully; roster Maps tab **and Map Editor preset picker** (both on refactored `BoardThumbnail`) are pixel-identical
- [ ] Saved Teams tab with ~200 teams: page load is unaffected (panel not mounted); opening the tab stays responsive (content-visibility)
- [ ] Export → clear browser storage → import → library identical (200-cap respected); re-imported teams are not dirty after Select
- [ ] Wrap toggle only in 5-board modes; wrap flag round-trips for them
- [ ] Cross-board drag, page-wide uniqueness, swap, team view, invert — unchanged in 1v1/3v3 (1 and 3 boards)
- [ ] Private-mode/quota-disabled storage: page functional, saves silently skipped, Save shows error toast

---

## 6. Review Findings (Staff Engineer + Architect audit — Rev 3 resolutions)

Two independent persona reviews audited Rev 2 against the source; every blocker/major finding was then **adversarially verified by a separate agent reading the cited code** (all five confirmed). Both reviewers' overall verdicts: the investigation is accurate in every spot-checked citation and the architecture is sound; the majors below required a Rev 3, not a redesign.

| #   | Severity | Finding (verified)                                                                                                                                                                       | Resolution in Rev 3                                                                                                                                   |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | major    | Dirty check compared raw encodings that embed the active-board index + display flags — clicking a board or toggling Flat marked a saved team dirty; Save baked viewer state into records | **Canonical team data** (§3.4): one normalizer strips `d`/`active`; used by every library write and both sides of the dirty compare (invariant 12)    |
| 2   | major    | `?g=` ingress trusted a payload's `mode` without checking board count, and the promised short-link padding had no implementing phase step — a slot-corruption path                       | `resolveTeamMode` contradiction rule + `normalizeTeamPayload`, applied at the teams ingress in `useTeamsRestore` (§3.8, Phase 1 step 5, ingress test) |
| 3   | major    | Saved Teams panel mounts inside the roster's eager `TabView` → ~45k SVG polygons at cap on page load, tab never opened                                                                   | Lazy mount on first activation + `content-visibility` budget + shared hex geometry + occupied-only clipPaths (§3.5, §3.9)                             |
| 4   | minor    | Pause flag as sketched never gates anything under pre-flush timing; risk of "simplifying away" or of a future async step breaking silently                                               | Flush semantics pinned in §3.3 (pre-flush + pause as mandatory defense-in-depth); write-spy regression assertions                                     |
| 5   | minor    | Dangling `sourceId`s (delete from another mode, Delete all, cross-tab, backup restore) unspecified                                                                                       | Self-heal rule at slot adoption; `source ≡ get(sourceId) ?? null` (§3.2, invariant 11); cross-mode delete test                                        |
| 6   | minor    | Imported records never byte-match re-encodes → permanently dirty                                                                                                                         | Import canonicalizes `data` (§3.7); round-trip test                                                                                                   |
| 7   | minor    | `teamLibrary` store specified to toast — violates the layering rule the doc itself restates                                                                                              | Store returns typed results; callers toast (§3.0, §3.4, invariant 9)                                                                                  |
| 8   | minor    | Switch sequence rebuilt boards twice (defaults, then restore's own rebuild); invariant 2 wording contradicted the restore path                                                           | Restore-or-default single rebuild (§3.3 step 4); invariant 2 reworded to "one orchestrator, delegated mechanism"                                      |
| 9   | minor    | Sequence dropped hex-size pinning; virgin-mode display-flag policy undefined                                                                                                             | Step 6: hex-size re-assert + virgin mode keeps current flags (§3.3)                                                                                   |
| 10  | minor    | Unknown-mode / `v`-mismatch hydration unspecified (future mode removal)                                                                                                                  | Add-only mode rule (§3.1); hydration drops invalid records with warn, unknown `v` → empty (§3.4)                                                      |
| 11  | minor    | Multi-tab clobbering undocumented/undecided                                                                                                                                              | Documented decision: out of scope, last-writer-wins; read-modify-write mutations narrow the window (§3.2)                                             |
| 12  | minor    | ArenaPreviewGrid refactor also changes the Map Editor, which the scope statement declared untouched                                                                                      | Scope line amended; QA pixel-checks both consumers                                                                                                    |
| 13  | minor    | Test plan assumed jsdom/test-utils; the repo's vitest is node-env only                                                                                                                   | Harness constraints pinned in §5; orchestration and thumbnail mapping designed headless-testable                                                      |
| 14  | nit      | Thumbnails ignore `t` divergence from `m` (hand-crafted imports preview ≠ select)                                                                                                        | Documented as intentional leniency (§3.5)                                                                                                             |
| 15  | nit      | Rejected alternatives not recorded — invites relitigation                                                                                                                                | Appendix C                                                                                                                                            |

## 7. Resolved Decisions (Rev 2)

| #   | Question (Rev 1) | Decision                                                                                                      |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | "Edit" control   | **Select** (load as active) + inline rename on the card                                                       |
| 2   | Save semantics   | **Save updates the currently-selected (source) team; Save as New creates a copy** — provenance via `sourceId` |
| 3   | Overwrite guard  | No confirm on Select for now; toast + dirty-dot make state legible                                            |
| 4   | Mode memory      | Yes — persist last-used mode; first visit defaults to 5v5 Supreme League                                      |
| 5   | Cap              | **200**                                                                                                       |
| 6   | Naming           | Auto-name + **user-entered name on Save as New**, max **60 chars**; inline rename stays                       |
| 7   | Thumbnails       | **Hero portraits in v1** via shared `BoardThumbnail` (ArenaPreviewGrid refactored onto it)                    |
| 8   | Import policy    | Merge + skip duplicates + fresh ids; **Delete all** added so "replace" = Delete all + Import                  |
| 9   | Mode set         | Confirmed, **plus 1v1**: `1v1 / 3v3 / 5v5 / 5v5 Supreme League`, segmented control (revisit if list grows)    |
| 10  | Export scope     | All teams — backup is the purpose                                                                             |
| —   | Directory layout | Non-UI logic in **`src/lib/teams/`**; components in `components/teams/`; store in `stores/`                   |
| —   | Legacy/migration | **Dropped** — clean-slate storage schema; old `stargazer.teams` key deleted unread                            |
| —   | Card actions     | Select / Duplicate / Delete at equal width on the card                                                        |

---

## 8. Implementation Report (Rev 4)

All four phases are implemented on this branch, one commit per phase (`Teams phase 1..3` + the polish commit this report ships in). Validation per phase: `npm run lint`, `npm run type-check`, the full vitest suite, and a real-browser (Playwright/Chromium) walkthrough against the dev server; final sweep ran `npm run prep`.

### What shipped, by phase

- **Phase 1** — `src/lib/teams/modes.ts` (registry + `resolveTeamMode` + `normalizeTeamPayload`), per-mode `ActiveSlot` persistence with pause/flush, `useTeamsRestore` (switch sequence + `?g=` ingress), `MultiGridState.mode`, `hasDisplayFlags` in the restore result, mode picker UI, tab rename. Browser-verified: 4 segments, per-mode board counts/maps, wrap gating, reload restores last mode, exact storage schema.
- **Phase 2** — canonical team data (`savedTeam.ts`), `teamLibrary` store (validated hydration, read-modify-write, cap 200), `BoardThumbnail` (shared geometry, occupied-only clipPaths, portraits + dot fallback), `ArenaPreviewGrid` refactored onto it (Maps tab + Map Editor), `TeamPreview`, lazy-mounted `SavedTeamsList` (badge, Delete all, equal-width actions, inline rename, `content-visibility`), Save / Save-as-New with provenance + dirty dot. Browser-verified end-to-end, including: dirty appears on content edit only (board clicks and flag toggles do not trip it), Save-with-source updates in place without the popover, portraits render on the right hexes.
- **Phase 3** — `transfer.ts` (`buildExport` / `parseImport`), store `exportAll` / `importTeams`, Export/Import buttons + hidden file input. Browser-verified: download → Delete all → import restores; re-import skips duplicates; malformed file rejects with the library untouched.
- **Phase 4** — `/share` wrap gating (cosmetic), `gridStateSerializer.ts` misleading comment fixed, GRID.md + URL_SERIALIZATION.md updated, new `docs/architecture/SAVED_TEAMS.md`, CLAUDE.md index entry.

### Deviations from the Rev 3 spec (all minor)

1. **`src/utils/storage.ts` (new)** — the SSR-guarded localStorage helpers were extracted from `useGridPersistence` so the library _store_ can use them without importing from a composable module (layering rule). Not in the Rev 3 file list.
2. **`src/lib/teams/preview.ts` (new)** — the record→thumbnail-units mapping got its own lib module (Rev 3 said "lives in `src/lib/teams/`" without naming a file).
3. **Export/Import wiring** — implemented as emits on `TeamModeControls` (`exportTeams`, `importFile(raw)`) with the file read in the component and all store access + toasts in `TeamsView`, instead of a slotted sub-component. Same behavior, simpler tree. `IconUpload.vue` added for the Import glyph.
4. **`importTeams` result** — returns `{ imported, skipped, invalid }` (boolean) rather than an error string; the caller maps it to the invalid-file toast.
5. **Auto-name semantics** — `nextAutoName` is "count + 1, skip taken names" (deleting teams can leave gaps in numbering; a freed low number is not reused). Cosmetic; pinned by test.
6. **Canonicalization detail beyond spec** — `canonicalTeamData` rebuilds each board's keys in the serializer's emission order (t, c, p, pr, a, m) and re-resolves `mode`, so hand-ordered imports are byte-identical to fresh serializes. This was implied by the audit's "make the compare symmetric" and is pinned by tests.
7. **`initialize` also persists the mode key on the no-link path** — a gap the regression tests caught (a first visit would otherwise not write `stargazer.teams.mode` until the first switch).
8. **Data-load failure fallback** — with `gameDataStore.dataLoaded` false, TeamsView builds the default mode's empty boards with no persistence (the old page showed boards in this state too; Rev 3 didn't specify it).
9. **Phantimal portraits** resolve through the existing remote `phantimalImageUrl` helper (same as the boards themselves); unresolvable ones fall back to the team dot as specced.

### Test coverage added

`tests/unit/lib/teams/{modes,savedTeam,transfer}.test.ts`, `tests/unit/composables/{useGridPersistence,useTeamsRestore}.test.ts`, `tests/unit/stores/teamLibrary.test.ts` — 60 new tests, 729 total passing. The §3.3 write-spy regression suite (per-mode round-trips byte-identical, equal-count rebuild, no old-slot write after flush / no new-slot write before baseline) encodes the old 3v3 failure permanently.

### Rev 5 addendum (post-review refinements)

Three refinements from the post-implementation review discussion:

1. **Defaults-change hard reset**: `ActiveSlot` gained a required `defaults` fingerprint (the mode's `defaultMaps` joined). `load()` discards a slot whose fingerprint doesn't match the registry, so shipping a new Supreme League map list resets users' active 5v5 SL boards onto it (label reverts to "Unsaved team"; saved teams unaffected). Pinned by test.
2. **`t` is authoritative — map configs are optional for persisted data**: the serializer emits every non-default tile (~26 even for an empty board) and restore replays them over a tile reset, so persisted/imported boards never need the arena JSON for correctness. Accordingly, `validateSavedTeam` no longer rejects unknown map keys (a retired map's teams keep working; only the Maps-tab highlight has nothing to point at), and the earlier "keep retired arena JSONs around" caveat is withdrawn. Configs remain necessary only for empty boards (fresh slates, padded links) and the map-picker UI.
3. **Thumbnails render from `t`**: `BoardThumbnail` accepts explicit tile states and `TeamPreview` passes the record's own `t`, so previews match exactly what Select produces — including hand-crafted `t`/`m` divergence and retired maps (this also resolves Rev 3 finding #14's accepted limitation).

### QA checklist status

Everything browser-verifiable headlessly was walked through and passes (desktop 1400px + mobile 390px viewports): mode round-trips, equal-count switch, reload/mode memory, crafted 2-board link padding, `?g=` overwrite + invalid-link fallback, Save/Save-as-New/Select/Duplicate/Delete/Delete-all/rename, dirty-dot content-only behavior, portraits, Maps tab + Map Editor previews, export→wipe→import round-trip, wrap gating per mode, saved-tab lazy mount. Not exercised in this environment: real share-link navigation to `/share` (route works, visual spot-check recommended), drag-and-drop across boards in 1v1/3v3 (engine is count-agnostic and unchanged; unit-covered), private-mode/quota-disabled storage, and a true 200-team library under `content-visibility` (typing/perf feel). Suggested manual pass: the four items above, on your hardware.

---

## Appendix A — File touch list

| File                                        | Phase | Change                                                                          |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------- |
| `src/lib/teams/modes.ts`                    | 1     | **new** — mode registry, `resolveTeamMode`, `normalizeTeamPayload`, constants   |
| `src/lib/teams/savedTeam.ts`                | 2     | **new** — SavedTeam type, naming rules, `canonicalTeamData`, record validation  |
| `src/lib/teams/transfer.ts`                 | 3     | **new** — export/import pure functions (validate + canonicalize)                |
| `src/composables/useGridPersistence.ts`     | 1     | per-mode `ActiveSlot` envelope slots, pause/flush, legacy-key delete            |
| `src/composables/useTeamsRestore.ts`        | 1     | **new** — restore/switch/ingress orchestration (the sole board-count initiator) |
| `src/utils/gridStateSerializer.ts`          | 1     | `MultiGridState.mode?` (always written)                                         |
| `src/stores/urlState.ts`                    | 1     | multi-restore result gains `mode` + `hasDisplayFlags`                           |
| `src/views/TeamsView.vue`                   | 1     | tab rename, `activeMode`, switch sequence, `?g=` mode sync                      |
| `src/components/teams/TeamsBoards.vue`      | 1–2   | render `TeamModeControls`; wrap gating                                          |
| `src/components/teams/TeamModeControls.vue` | 1–3   | **new** — picker + label; then Save/Save-as-New; then Export/Import             |
| `src/components/teams/BoardsRow.vue`        | 1     | verify/document 1-/3-board no-op of wrap CSS                                    |
| `src/stores/teamLibrary.ts`                 | 2–3   | **new** — library state + persistence (typed results, no toasts)                |
| `src/components/grid/BoardThumbnail.vue`    | 2     | **new** — shared SVG board renderer (portraits, shared geometry)                |
| `src/components/grid/ArenaPreviewGrid.vue`  | 2     | refactor to render through `BoardThumbnail` (Maps tab + Map Editor)             |
| `src/components/teams/TeamPreview.vue`      | 2     | **new** — saved-team thumbnail (decode → BoardThumbnails)                       |
| `src/components/teams/SavedTeamsList.vue`   | 2     | **new** — lazy-mounted cards + actions + Delete all                             |
| `src/components/teams/TeamsRoster.vue`      | 2     | fourth tab (`saved`, badge)                                                     |
| `src/components/ui/IconSave.vue`            | 2     | **new**                                                                         |
| `src/locales/app/*.json`                    | 1–3   | ~21 new keys (en + zh)                                                          |
| `src/views/ShareView.vue`                   | 4     | wrap gating for non-5-board payloads (cosmetic)                                 |
| `tests/unit/…`                              | 1–3   | new suites per phase; §5 regression + write-spy + canonicalization tests        |
| `docs/architecture/…`                       | 4     | GRID.md, URL_SERIALIZATION.md updates; serializer comment fix                   |

## Appendix B — localStorage schema after this design

```
stargazer.arena                     (unchanged) binary-encoded Arena state
stargazer.teams.mode                '1v1' | '3v3' | '5v5' | '5v5sl'
stargazer.teams.active.1v1          { v: 1, data: <encoded MultiGridState>, sourceId: string | null }
stargazer.teams.active.3v3          { v: 1, data: …, sourceId: … }
stargazer.teams.active.5v5          { v: 1, data: …, sourceId: … }
stargazer.teams.active.5v5sl        { v: 1, data: …, sourceId: … }
stargazer.teams.saved               { v: 1, teams: SavedTeam[] }   (≤ 200; SavedTeam.data is canonical)
stargazer.teams                     (legacy) deleted unread on first visit
```

## Appendix C — Considered and rejected

Recorded so implementation doesn't relitigate:

1. **Sibling tab per mode** — re-creates the shared-instance/single-slot failure class; makes a mobile tab strip appear for the first time (§2).
2. **Dropdown mode picker** — hides the available modes and adds a tap; four short segments fit (§2).
3. **IndexedDB for the library** — measured volumes (~6 KB/team) make localStorage ample; IndexedDB adds async complexity everywhere (§3.4).
4. **Stored image thumbnails** (canvas/html-to-image) — 20–100 KB+ each would dominate quota; DOM capture can't see non-live teams anyway; data→SVG is strictly better (§3.5).
5. **Per-team localStorage keys** (`stargazer.teams.saved.<id>`) — enumeration + atomicity headaches for zero benefit at these sizes; one versioned blob with read-modify-write is simpler (§3.2/§3.4).
6. **Cross-tab `storage`-event sync** — real complexity (event replay, merge policy) for a single-user tool; last-writer-wins documented instead (§3.2).
7. **Raw JSON (not encoded string) as SavedTeam.data** — loses the free share-link compatibility and the single validated decode path; canonical encoding keeps both (§3.4).
8. **`flush: 'sync'` autosave watcher** — would encode+write on every intermediate mutation of a restore; pre-flush + pause is strictly better (§3.3).
9. **Save always creates new (Rev 1 semantics)** — replaced by user decision: Save updates source, Save as New copies (§7 #2).
10. **GridSnippet convergence onto BoardThumbnail now** — guide-specific features (highlights, labels, imaginary hexes) make it a separate change; deferred (§3.5).
