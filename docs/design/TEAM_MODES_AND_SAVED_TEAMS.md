# Design: Team Modes (N-Grid) & Saved Teams

> **Status**: Rev 2 — decisions resolved, awaiting final review
> **Scope**: Teams page (`/teams`) only. The Arena (`/`), Map Editor, and WandWars are untouched.
> **Companion mocks**: [`mocks/saved-teams-tab.html`](./mocks/saved-teams-tab.html), [`mocks/team-mode-controls.html`](./mocks/team-mode-controls.html)
> **Rev 2 changes**: all §6 open questions resolved (see §7); added 1v1 mode; Save-updates / Save-as-New semantics with provenance + unsaved-changes indicator; named saves (≤ 60 chars); cap raised to 200; shared `BoardThumbnail` renderer with hero portraits; Delete-all; lib code moved to `src/lib/teams/`; legacy migration dropped (clean-slate storage schema).

## Overview

This design generalizes the 5v5 tab into a **Teams** tab that supports a configurable number of boards ("team modes": 1v1, 3v3, 5v5, 5v5 Supreme League), with fully independent persisted state per mode. On top of that it adds a **Saved Teams** library: named snapshots of any N-grid team that can be selected, updated, duplicated, deleted, exported to JSON, and imported back.

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

`TeamsRoster.vue` renders a `TabView` with `characters` / `seasonal` / `maps` tabs inside a `BottomSheet` (desktop card / mobile pull-up sheet). The Maps tab is `ArenaPreviewGrid`, which renders **each map as a small inline SVG of hex polygons** (`ArenaPreviewGrid.vue:22-38`). The guide pages have a richer variant, `GridSnippet.vue`, which additionally renders **hero portraits as SVG `<image>` elements clipped to hex shapes** (`GridSnippet.vue:180-205`). Together these are the in-repo precedent the thumbnail design consolidates (§3.5). Map selection calls `gridStore.switchMap(mapKey)` on the _active_ board.

### 1.5 Why the previous 3v3 tab failed (reconstruction)

Git history has been squashed ("clean up" commits), so the buggy attempt itself is gone, but the failure is fully explained by the current structure:

1. **One board array** — both tabs render `v-for ctx in grids.contexts`; with `TabView eager` both panels are mounted at once and literally show the same boards.
2. **One storage slot** — both tabs' autosaves write `stargazer.teams`. Switching tab rebuilds the array (`setGridCount`), the autosave watcher fires on the new (empty or differently-sized) snapshot, and **overwrites the other mode's save**.
3. **Rebuild-on-switch races** — `watch(activeTab)` only rebuilds when counts differ; restore, autosave start, and flag application are interleaved at page level and were never designed to be re-entrant per tab.

**Design conclusion:** the bug class disappears when (a) _mode is data, not a tab_ — a single owner (one panel, one watcher, one persistence pipeline) reconfigures the one board array, and (b) _each mode has its own storage slot_ with an explicit, ordered switch sequence (flush → rebuild → restore → resume autosave). That is exactly what §3 specifies.

### 1.6 Misc facts the design depends on

- i18n: one JSON file per key in `src/locales/app/` with `{ "en": …, "zh": … }` values; `app.teams` ("Teams"/"阵容") already exists. Basenames must be unique across `app/` and `app/messages/` (loader flattens subfolders and warn-overwrites duplicates, `dataLoader.ts:255-279`).
- Export precedent: `downloadBlob` + `timestampedName` (`src/utils/download.ts`); toasts via `useToast`. File-import precedent: WandWars records (`WandWarsView.vue:186` area) — export via `downloadBlob(new Blob([...], { type: 'text/plain' }))`, import via a hidden `<input type="file">` behind a button + `await file.text()` + per-entry validation with invalid entries dropped — exactly the shape §3.7 needs. There is no confirm-dialog precedent (destructive actions like Clear act immediately; `BaseModal` is a dark glass overlay that would clash on the cream card).
- Icons are per-glyph SFCs (`src/components/ui/Icon*.vue`, feather-style, `currentColor`): `IconTrash` = delete, `IconCopy` = duplicate, `IconDownload` = export, `IconEdit` = rename already exist; only Save (and optionally an upload/import glyph) are new.
- Character portraits: `loadCharacterImages()` (`dataLoader.ts:88-102`) provides `Record<name, url>` (100×135 webp, bottom-fit); `gameDataStore.getCharacterById(id)` resolves id → `CharacterType` (name), `gameDataStore.getCharacterImage(name)` resolves name → url. `GridSnippet.vue` shows the SVG clip-path portrait technique.
- `/teams` is not SSG pre-rendered (SPA-only route; Netlify `_redirects` SPA fallback preserves `?g=`), and all storage code is SSR-guarded, so no new constraints.
- Tests live in `tests/unit/**` mirroring `src/` (existing suites for `grids`, `urlState`, `gridStateSerializer`, `urlStateManager`) and run via `vitest`.

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

**Tab rename**: the outer tab `5 v 5` → **Teams** (reuse existing `app.teams` key). The Image Stitcher tab is unchanged.

---

## 3. High-Level Design

### 3.0 Code layout (`src/lib/teams/`)

All new non-UI logic lives in a dedicated **`src/lib/teams/`** folder (per review). UI stays where the repo's conventions put it:

| Layer       | Location                                                                                     | Contents                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Pure lib    | `src/lib/teams/modes.ts`                                                                     | mode registry, `resolveTeamMode`, constants                                  |
| Pure lib    | `src/lib/teams/savedTeam.ts`                                                                 | `SavedTeam` type, name rules, record validation                              |
| Pure lib    | `src/lib/teams/transfer.ts`                                                                  | export envelope build + import validation (pure, exhaustively unit-testable) |
| Pinia store | `src/stores/teamLibrary.ts`                                                                  | thin reactive wrapper: state + persistence + toasts; delegates logic to lib  |
| Composables | `src/composables/useGridPersistence.ts` (rework), `src/composables/useTeamsRestore.ts` (new) | per-mode slots, restore orchestration                                        |
| Components  | `src/components/teams/*`, `src/components/grid/BoardThumbnail.vue`                           | UI                                                                           |

This respects the documented layering rule (composables may call stores; stores must never call composables; lib imports neither).

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

// Mode for a decoded MultiGridState without a `mode` field (or with an unknown one):
// 5 boards → '5v5sl' (all such links predate the mode field and are today's SL page);
// otherwise the first mode in TEAM_MODE_ORDER with boardCount >= boards.length.
export function resolveTeamMode(state: MultiGridState): TeamModeKey
```

Notes:

- `MAX_GRID_COUNT` stays 5 and stays the clamp for crafted URLs.
- 1v1 gets the full Teams treatment (mode slot, saved teams, share links). It coexists with the Arena home page: the Arena remains the free-form single-board editor with its own binary codec and `stargazer.arena` slot; teams-page 1v1 is "a saved-able one-board team" using the multi codec. No interaction between the two.
- Adding a future mode = one entry here + one i18n file. Nothing else.

### 3.2 Per-mode active team state (localStorage)

Clean-slate schema (per review, **no legacy migration**: the old `stargazer.teams` key is simply ignored and removed; pre-existing autosaves are not carried over):

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
  data: string // encoded MultiGridState (same codec as share links)
  sourceId: string | null // SavedTeam.id this active team was loaded from / last saved to
}
```

The envelope exists because Save-updates-selected (§3.4) needs **provenance**: the active team must remember which saved team it belongs to. `sourceId` is cleared when no source exists (fresh slate) and re-pointed on Select / Save as New. A slot that fails `JSON.parse` or whose `data` fails decode is treated as absent (fresh defaults) — same graceful-failure policy as everything else.

On first visit after deploy, all keys are absent → the page opens on `DEFAULT_TEAM_MODE` with default boards. `stargazer.teams` (old key) is deleted if present, without being read.

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
})
```

`TeamsView` owns `activeMode = ref<TeamModeKey>(…)` and performs every switch in this exact order:

1. `paused = true`
2. flush: write current snapshot → `keyFor(oldMode)` _(normally a no-op — autosave already mirrored it)_
3. `activeMode = newMode`; persist `stargazer.teams.mode`
4. `grids.setGridCount(cfg.boardCount, cfg.defaultMaps)`; `clearTargetHex()`; `clearLiftedHex()` _(same hygiene as today's tab watcher, `TeamsView.vue:96-101`)_
5. restore `keyFor(newMode)` via `urlStateStore.restoreMultiFromEncodedState(slot.data)` if present (apply its display flags, adopt its `sourceId`); otherwise the fresh defaults from step 4 stand with `sourceId = null`
6. if `!TEAM_MODES[newMode].canWrap`, force `wrapBoards = false` (keeps the serialized `d` bit-6 at 0 for non-wrap modes)
7. `paused = false`; write one baseline snapshot to `keyFor(newMode)`

This ordering is what makes "edit 5v5 → switch to 3v3 (clean slate) → switch back (edits intact)" hold by construction: a mode's slot is only ever written while that mode's boards are live. **A dedicated regression test for this sequence is part of Phase 1** (§5) — it is the exact failure of the previous attempt.

> ⚠️ **Equal-count trap**: today's tab watcher skips the rebuild when the target count equals `contexts.length` (`TeamsView.vue:97`) — an optimization for the Image Stitcher round-trip. A mode switch must **not** inherit that check: `5v5 → 5v5sl` keeps the count at 5 but changes maps and state, so step 4 always rebuilds. (Toggling to the Image Stitcher tab and back is not a mode switch and still leaves boards untouched.)

Three details of the sequence, verified against current behavior:

- **Restore → `applyFlags` → arm autosave, in that order** (today's order, `TeamsView.vue:124-135`): the baseline write must reflect the restored display flags, or it persists stale ones.
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
  data: string // encoded MultiGridState — same codec as share links/autosave
  createdAt: number // epoch ms
  updatedAt: number
}

// stored under 'stargazer.teams.saved' as { v: 1, teams: SavedTeam[] }

export const useTeamLibrary = defineStore('teamLibrary', () => {
  const teams = ref<SavedTeam[]>([]) // hydrated once from storage, mirrored on change
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
```

Semantics (per resolved decisions):

- **Save** (primary): if the active slot's `sourceId` resolves to an existing saved team, **update it in place** (`data` + `updatedAt`; name and `createdAt` keep). Toast: "Saved to ⟨name⟩". If `sourceId` is null or the source was deleted, Save degrades to Save as New (below).
- **Save as New**: opens a lightweight name popover anchored to the button — a text input prefilled with the next auto-name (`Team N`), max 60 chars, Enter commits / Esc cancels (mock shows it). Creates the record and points the active slot's `sourceId` at it, so subsequent Saves update it.
- **Select** (on a card): loads the team into the active slot — switch `activeMode` to `team.mode` (full §3.3 sequence), `restoreMultiFromEncodedState(team.data)`, set `sourceId = team.id`, baseline-write. Overwrites that mode's current active team (per spec); toast "Team loaded". Selection from the mobile sheet collapses the sheet.
- **Unsaved-changes indicator**: the active team is _dirty_ when `activeEncoded !== get(sourceId)?.data` (a plain string compare — both sides are the same codec). The controls row shows the **active team label** — the source team's name, or "Unsaved team" when `sourceId` is null — with a dot when dirty. This is what makes Save-updates-selected legible.
- **Delete** (per card): two-step inline confirm (button arms → "Confirm?" for ~3 s), no modal. If the deleted team is the active `sourceId`, the active boards are untouched but `sourceId` becomes null (label reverts to "Unsaved team").
- **Delete all** (tab header, next to the count): same two-step confirm, clears the library. Complements merge-only import: "replace all" = Delete all + Import.
- **Duplicate**: copy with fresh id, name `"<name> (copy)"` clamped to 60.
- **Rename**: inline on the card (click name; Enter/blur commits, Esc cancels).

**Why store the encoded string (not raw JSON)?** It reuses the exact codec + validation path of share links (`decodeMultiGridStateFromUrl` is the integrity check), keeps the library entries directly shareable (`/share?g=<data>` works verbatim, enabling a per-team Share action later), and makes export/import trivially round-trippable.

**Size & limits**: **measured with the repo's own encoder**, a fully-populated 5-board team is ≈ 3,060 encoded chars ≈ **6 KB** as stored (localStorage is UTF-16); smaller modes proportionally less. `MAX_SAVED_TEAMS = 200` (per review) ≈ 1.2 MB worst-case against the typical ~5 MB/origin quota — safe, with headroom left for the rest of the app's keys. The cap is enforced in `saveAsNew`/`duplicate`/`importTeams` with a toast. The quota risk would only appear if thumbnails were ever _stored_ as images (20–100 KB+ each) — which §3.5 deliberately avoids. Quota errors are already handled as best-effort (silent catch) in the storage helpers; the library additionally surfaces an error toast on a failed save (unlike autosave, the user explicitly asked for it).

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

- **`TeamPreview.vue`** (saved-team card) decodes `team.data` once (memoized computed) and renders one `BoardThumbnail` per board: `mapKey` from `m`; `units` from `c` (characterId → `gameDataStore.getCharacterById(id)?.name` → `getCharacterImage(name)`) and `p` (phantimals → their icon via the same asset dictionaries, or dot fallback). Corrupt records render a fallback tile with a warning glyph instead of breaking the list.
- **Portraits are v1** (per review). Unresolvable ids (data from a future version, missing image) fall back to the team-colored dot, so a thumbnail never breaks.
- **`ArenaPreviewGrid` is refactored to render through `BoardThumbnail`** (no `units`), keeping its own card chrome/selection ring. Its per-map throwaway-`Grid` logic moves into the shared component. This is a small, mechanical refactor with an existing visual to pixel-match; do it in the same phase so there are two consumers from day one.
- **`GridSnippet` stays as-is** for now — it has guide-specific features (highlight groups, numeric labels, imaginary hexes) and name-keyed configs; converging it onto `BoardThumbnail` is a follow-up, not part of this feature. Noted in the doc so the third copy doesn't proliferate further.
- The DOM-capture path (`useGridExport` / html-to-image) is **not** viable for thumbnails: it only captures mounted DOM, and saved teams are by definition not the live boards. Data→SVG is the only correct source, and nothing image-like is ever stored.

### 3.6 New controls row (TeamModeControls)

New component `src/components/teams/TeamModeControls.vue`, rendered by `TeamsBoards.vue` **above** the existing `GridControls` row:

- **Mode picker** — segmented control: `1v1 · 3v3 · 5v5 · 5v5 Supreme League` (from `TEAM_MODES`/`TEAM_MODE_ORDER`). Switching is instant and lossless (each mode keeps its own state), so no confirmation is needed.
- **Active team label** — the source team's name (or "Unsaved team"), with an unsaved-changes dot (§3.4). Read-only in v1 (rename lives on the card).
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

Export's purpose is **backup** (per review): it always contains the whole library.

Import validation (pure function in `src/lib/teams/transfer.ts`), in order: envelope shape (`app`/`kind`/`version` known) → per-record: `mode` passes `isTeamModeKey`, `name` is a non-empty string (trim, clamp 60), `data` decodes via `decodeMultiGridStateFromUrl`, `boards.length === TEAM_MODES[mode].boardCount`, **every board's `m` key exists in `MAPS`** (an unknown `m` would build the default layout while `currentMap` names a nonexistent map — a known footgun in `createGridContext`), **and `d` is present — normalize to `packDisplayFlags` defaults if missing** (`unpackDisplayFlags(undefined)` defaults `showArrows` to **true**, so a hand-crafted record omitting `d` would flip targeting arrows on at load). Valid records are **merged** (never replace): fresh `id`s are assigned; records whose `data` + `name` exactly match an existing team are skipped as duplicates; cap 200 enforced. Result toast: "Imported N teams (M skipped)". A malformed file → error toast, library untouched. Import never touches the active boards. "Replace all" = Delete all (§3.4) + Import.

Two deliberate non-goals: we do not deep-validate `t` tile entries against `m` (a hand-edited mismatch renders `t`'s layout — same lenient behavior as share URLs), and hand-crafted duplicate heroes are handled by the existing restore-time repair (`dedupeCharacters`) when the team is _selected_, exactly like a crafted share URL.

### 3.8 URL serialization & share links

- `MultiGridState` gains an optional `mode?: TeamModeKey` field, **always written** by the serializer from now on; the decoder tolerates absence (no version bump needed — the format is self-describing JSON and existing links must keep decoding).
- **Mode resolution for links without `mode`** (`resolveTeamMode`, §3.1): 5 boards → `5v5sl` (all such links are today's SL page); otherwise the first mode in `TEAM_MODE_ORDER` with `boardCount ≥ boards.length`, padding missing boards with the mode's default maps; the existing clamp (`urlState.ts:206`) handles the too-many case.
- `/teams?g=<encoded>` → decode, resolve mode, **switch the mode picker to it**, and overwrite that mode's active slot with `sourceId = null` (a shared link is nobody's saved team). Decode failure → error toast → fall back to `stargazer.teams.mode` + its slot (existing priority logic generalizes unchanged).
- `/share` (read-only) needs no functional change (it renders `boards.length` boards already — including one board, which decodes as multi and renders a single-board row). A 3-board payload with the wrap bit set already degrades gracefully; the Phase-4 "gate wrap on `boards.length === 5`" item is cosmetic hardening only.
- **In-app navigation caveat**: today every entry into `/teams?g=` is a hard navigation (ShareView's Edit pencil is a plain `<a href>`), so the direct `window.location.search` read is always current. If a future feature navigates in-app (e.g. per-saved-team "open in editor" via `router.push`), it must read `getEncodedStateFromRoute` or force a reload — and note `?g=` is never stripped after restore, so a reload re-applies and re-overwrites (existing behavior).

### 3.9 Saved Teams tab (roster panel)

`TeamsRoster.vue` gains a fourth tab: `characters / seasonal / maps / saved` (label `app.saved-teams`, with a count badge via `TabItem.badge`). Panel component `src/components/teams/SavedTeamsList.vue`:

- Header row: count (`N / 200`), **Delete all** (two-step confirm), cap warning when ≥ 80% full.
- Responsive card grid; each card: `TeamPreview` thumbnail (portraits, §3.5), mode chip (`1v1` / `3v3` / `5v5` / `5v5 SL`), name (inline-editable), relative updated time, and actions **Select** / **Duplicate** / **Delete** — rendered at **equal width** (3-column grid within the card, per review) with Select visually primary.
- Empty state: hint text pointing at the Save buttons.
- Selecting from the mobile sheet collapses the sheet (same pattern as character placement, `TeamsRoster.vue:44-51`).

See the HTML mock for the exact look.

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
9. **Layering rule** (ARCHITECTURE.md): composables may call stores; stores must never call composables; `src/lib/teams/*` imports neither. `useTeamLibrary` is a store (no composable imports); the switch/restore orchestration lives in `useTeamsRestore` (composable) or the view.
10. **`startAutosave`'s initial unconditional write is load-bearing** — it is what commits a `?g=` payload over the slot. Keep the order: restore first, then arm autosave (which writes the baseline).

---

## 4. Architecture Assessment (refactor vs. bolt-on)

**No major refactor is needed — and that is a finding, not a compromise.** The codebase already has the shape a from-scratch design would choose: per-board state is encapsulated in `GridContext`, the collection + cross-board rules live in one store, the snapshot codec is count-agnostic, and the page already declares "modes as data" (`GRID_TABS`). The design therefore _completes_ existing seams rather than fighting them:

- `GRID_TABS` → `TEAM_MODES` registry (same idea, promoted to `src/lib/teams/` with types).
- Single teams storage slot → keyed slots + explicit switch protocol (the one genuinely missing piece).
- Snapshot string → reused as the saved-team payload (zero new codecs).
- Two hand-rolled SVG board renderers → one shared `BoardThumbnail` with two consumers (three when guides converge later).

Deliberately **not** done (over-engineering for current needs):

- No IndexedDB (localStorage volumes are trivial, §3.4); revisit only if thumbnails ever become stored images.
- No arbitrary-N UI (registry supports it; product doesn't need it yet — `MAX_GRID_COUNT` guard stays).
- No GridSnippet convergence in this feature (§3.5).
- No new global event bus, no changes to drag & drop, uniqueness, phantimals, or skills — all verified count-agnostic.

One small cleanup **is** included while touching `TeamsView`: extract the `?g=`-vs-slot restore priority logic (currently inline, `TeamsView.vue:121-136`) into `useTeamsRestore` so the mode-switch path, the saved-team Select path, and the initial-load path share one restore implementation. This keeps the critical sequence (§3.3) in exactly one place.

---

## 5. Execution Plan

Four phases, each independently shippable and reviewable. After each phase: `npm run lint && npm run type-check && npm run test`.

### Phase 1 — Mode foundation (1v1 + 3v3 support, rename, per-mode persistence)

_Deliverable: Teams tab with a working 1v1 / 3v3 / 5v5 / 5v5 SL picker, independent per-mode state, wrap hidden for non-5-board modes._

1. **Create `src/lib/teams/modes.ts`** — registry as specified in §3.1 (types, `TEAM_MODES`, `TEAM_MODE_ORDER`, `DEFAULT_TEAM_MODE`, `MAX_SAVED_TEAMS`, `MAX_TEAM_NAME_LENGTH`, `isTeamModeKey`, `resolveTeamMode`).
2. **Rework `src/composables/useGridPersistence.ts`**:
   - Add `TEAMS_MODE_KEY = 'stargazer.teams.mode'`, slot helper `teamsSlotKey(mode)`; `ActiveSlot` envelope read/write (JSON parse/stringify around the encoded string + `sourceId`).
   - `useTeamsPersistence(mode, sourceId, getFlags)` returning `{ loadMode(), load(mode), flush(), setPaused(paused), startAutosave() }` per §3.3; keep `useArenaPersistence` untouched. Replaces the stop-handle-less watch with a single pausable watcher keyed by the live mode ref — guard against double registration.
   - Delete the legacy `stargazer.teams` key on init (no read, no migration).
3. **Update `src/utils/gridStateSerializer.ts`**: add `mode?: string` to `MultiGridState`; `serializeMultiGridState` gains a `mode` arg (always written). `resolveTeamMode` lives in `lib/teams/modes.ts` next to the registry.
4. **Update `src/stores/urlState.ts`**: `restoreMultiFromEncodedState` returns the resolved mode in its result so callers can sync the picker.
5. **Rewire `src/views/TeamsView.vue`**:
   - Tab defs: `fiveVFive` key → `teams`, label `i18n.t('app.teams')`; delete `GRID_TABS` in favor of `activeMode = ref(DEFAULT_TEAM_MODE)` + `TEAM_MODES`.
   - **Create `src/composables/useTeamsRestore.ts`** (per §4) and implement `switchMode(next)` exactly per §3.3; initial load order: `?g=` (sets mode per payload, `sourceId = null`) → `stargazer.teams.mode` + its slot → default mode. **Do not reuse the current count-equality rebuild check** (`TeamsView.vue:97`) for mode switches — see the §3.3 equal-count trap.
   - Wrap: pass `:can-wrap="!isSheet && TEAM_MODES[activeMode].canWrap"`.
6. **Create `src/components/teams/TeamModeControls.vue`** (mode picker + active-team label placeholder in this phase) and render it in `TeamsBoards.vue` above `GridControls`; segmented-control markup/styles per mock.
7. **Verify `BoardsRow` wrap CSS** no-ops for 1 and 3 boards (the `:nth-child(4)/(5)` selectors match nothing — verify, then document in place).
8. **i18n**: `mode-1v1.json`, `mode-3v3.json`, `mode-5v5.json`, `mode-5v5-sl.json` (en + zh).
9. **Tests** (`tests/unit/`):
   - `lib/teams/modes.test.ts`: registry invariants (`defaultMaps.length === boardCount`, all maps exist in `MAPS`, counts ≤ `MAX_GRID_COUNT`); `resolveTeamMode` inference table (1, 3, 5, absent mode, unknown mode, crafted 2/4/7).
   - `composables/useGridPersistence.test.ts`: slot routing per mode; envelope round-trip (incl. `sourceId`); corrupt envelope → absent; pause semantics; legacy-key deletion.
   - **The regression test**: build 5v5sl state → switch to 3v3 → assert 3v3 slot untouched & boards default → switch back → assert 5v5sl state restored byte-identical. This encodes the previous attempt's failure as a permanent guard. Include the 5v5 ↔ 5v5sl equal-count case.
   - `utils/gridStateSerializer.test.ts`: `mode` round-trip.

### Phase 2 — Saved Teams library (store, tab, Save/Save-as-New, thumbnails)

_Deliverable: Save + Save as New with provenance; Saved Teams roster tab with portrait thumbnails, Select / Duplicate / Delete / Delete all / rename._

1. **Create `src/lib/teams/savedTeam.ts`** (types, name normalization/clamping, auto-name `Team N`, duplicate naming) and **`src/stores/teamLibrary.ts`** per §3.4 (hydrate-once + mirror-on-change watch; cap 200; storage `{ v: 1, teams }`; corrupt JSON → empty + console.warn). Select must sit behind the page's `gameDataStore.dataLoaded` gate (`TeamsView.vue:121`).
2. **Create `src/components/grid/BoardThumbnail.vue`** per §3.5 (map polygons + clipped portrait images + team ring + dot fallback; throwaway `Grid` per `mapKey`, memoized). **Refactor `ArenaPreviewGrid.vue` to render through it** (pixel-match the current look; keep its selection chrome).
3. **Create `src/components/teams/TeamPreview.vue`** per §3.5 (decode memoized; `c`/`p` → `ThumbnailUnit[]` via `gameDataStore.getCharacterById` + `getCharacterImage`; corrupt-record fallback tile).
4. **Create `src/components/teams/SavedTeamsList.vue`** per §3.9 (header with count + Delete all; card grid with equal-width actions; inline rename; two-step deletes; empty state; emits `select(team)`).
5. **Wire selection + provenance**: `TeamsRoster` adds the `saved` tab (badge = count); Select flows through `useTeamsRestore` (sets `sourceId`); collapse sheet on mobile.
6. **Extend `TeamModeControls`**: active-team label + dirty dot (string compare per §3.4); Save (update-or-degrade) + Save as New with name popover (new small component or inline; prefilled auto-name; Enter/Esc; 60-char clamp). New `src/components/ui/IconSave.vue`; reuse `IconCopy`/`IconTrash`/`IconDownload`.
7. **i18n**: `saved-teams.json`, `save.json`, `save-as-new.json`, `team-name.json` (popover label/placeholder), `unsaved-team.json`, `team-saved.json`, `team-loaded.json`, `team-deleted.json`, `delete-all.json`, `duplicate.json`, `confirm.json`, `teams-limit.json`, `saved-teams-empty.json` (+zh). Basenames verified unique across `app/` and `app/messages/`.
8. **Tests**: `lib/teams/savedTeam.test.ts` (naming rules, clamping); `stores/teamLibrary.test.ts` (CRUD incl. update/removeAll, cap 200, corrupt-storage hydration, duplicate naming); store-level integration: save-as-new → edit boards → dirty flag on → Save updates source → Select another team switches mode + repoints `sourceId`; delete source → `sourceId` null.

### Phase 3 — Export / import

1. **Create `src/lib/teams/transfer.ts`**: `buildExport(teams)` and `parseImport(raw)` as pure functions per §3.7.
2. **Wire export**: `downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), timestampedName('stargazer-teams', 'json'))`.
3. **Wire import**: hidden file input in `TeamModeControls` (WandWars pattern); `await file.text()` → `parseImport` → merge; result toast.
4. **Tests**: exhaust `parseImport` (bad envelope, bad mode, undecodable data, count mismatch, unknown map key, missing `d` normalization, name clamping, dup skip, cap overflow) — it is the only place untrusted file content enters the app.
5. **i18n**: `export.json`, `import.json`, `import-success.json`, `import-invalid.json` (+zh).

### Phase 4 — Polish & docs

1. `/share` wrap gating on `boards.length === 5` (cosmetic hardening — verify, then decide if the line is worth it).
2. Docs: update `docs/architecture/GRID.md` (board array + modes), `URL_SERIALIZATION.md` (`mode` field, saved-team reuse of the codec), add `SAVED_TEAMS.md` if warranted; follow `STYLE_GUIDE.md`. Also fix the misleading comment at `gridStateSerializer.ts:161-162` ("tile states carry only the edits" — they carry every non-default tile including the map baseline).
3. Sweep: `npm run prep` (format + type-check + lint + test), manual pass over the QA checklist below.

### QA checklist (manual)

- [ ] Edits in each of the four modes survive round-trips through every other mode (desktop + mobile)
- [ ] 5v5 ↔ 5v5sl switch (equal board count) rebuilds maps + state correctly
- [ ] Reload restores last mode and its state; first-ever visit lands on 5v5 SL defaults; old `stargazer.teams` key is removed and ignored
- [ ] Old (pre-feature) share links open correctly and select 5v5 SL
- [ ] New share link from each mode → `/share` renders the right board count; Edit pencil lands on `/teams` in that mode with payload applied
- [ ] `?g=` overwrite semantics per mode (`sourceId` cleared); invalid `?g=` → error toast + saved state intact
- [ ] Save updates the source team; Save as New pops the name input (prefill, 60-char clamp, Enter/Esc); dirty dot appears on edit, clears on Save/Select
- [ ] Select/Duplicate/Delete/Delete-all/rename; select from another mode switches the picker; deleting the source team nulls the label
- [ ] Thumbnails show portraits on the right hexes/teams; corrupt record falls back gracefully; Maps tab (refactored ArenaPreviewGrid) is pixel-identical
- [ ] Export → clear browser storage → import → library identical (200-cap respected)
- [ ] Wrap toggle only in 5-board modes; wrap flag round-trips for them
- [ ] Cross-board drag, page-wide uniqueness, swap, team view, invert — unchanged in 1v1/3v3 (1 and 3 boards)
- [ ] Private-mode/quota-disabled storage: page functional, saves silently skipped, Save shows error toast

---

## 6. Review Findings (Staff Engineer + Architect audit)

_This section is populated by the independent persona reviews; see revision history._

---

## 7. Resolved Decisions (Rev 2)

| #   | Question (Rev 1)          | Decision                                                                                                      |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | "Edit" control            | **Select** (load as active) + inline rename on the card                                                       |
| 2   | Save semantics            | **Save updates the currently-selected (source) team; Save as New creates a copy** — provenance via `sourceId` |
| 3   | Overwrite guard on Select | No confirm for now; toast + dirty-dot make state legible                                                      |
| 4   | Mode memory               | Yes — persist last-used mode; first visit defaults to 5v5 Supreme League                                      |
| 5   | Cap                       | **200**                                                                                                       |
| 6   | Naming                    | Auto-name + **user-entered name on Save as New**, max **60 chars**; inline rename stays                       |
| 7   | Thumbnails                | **Hero portraits in v1** via shared `BoardThumbnail` (ArenaPreviewGrid refactored onto it)                    |
| 8   | Import policy             | Merge + skip duplicates + fresh ids; **Delete all** added so "replace" = Delete all + Import                  |
| 9   | Mode set                  | Confirmed, **plus 1v1**: `1v1 / 3v3 / 5v5 / 5v5 Supreme League`, segmented control (revisit if list grows)    |
| 10  | Export scope              | All teams — backup is the purpose                                                                             |
| —   | Directory layout          | Non-UI logic in **`src/lib/teams/`**; components in `components/teams/`; store in `stores/`                   |
| —   | Legacy/migration          | **Dropped** — clean-slate storage schema; old `stargazer.teams` key deleted unread                            |
| —   | Card action sizing        | Select / Duplicate / Delete at equal width on the card                                                        |

---

## Appendix A — File touch list

| File                                        | Phase | Change                                                               |
| ------------------------------------------- | ----- | -------------------------------------------------------------------- |
| `src/lib/teams/modes.ts`                    | 1     | **new** — mode registry, `resolveTeamMode`, constants                |
| `src/lib/teams/savedTeam.ts`                | 2     | **new** — SavedTeam type, naming rules                               |
| `src/lib/teams/transfer.ts`                 | 3     | **new** — export/import pure functions                               |
| `src/composables/useGridPersistence.ts`     | 1     | per-mode `ActiveSlot` envelope slots, pause/flush, legacy-key delete |
| `src/composables/useTeamsRestore.ts`        | 1     | **new** — shared restore/switch orchestration                        |
| `src/utils/gridStateSerializer.ts`          | 1     | `MultiGridState.mode?` (always written)                              |
| `src/stores/urlState.ts`                    | 1     | return resolved mode from multi-restore                              |
| `src/views/TeamsView.vue`                   | 1     | tab rename, `activeMode`, switch sequence, `?g=` mode sync           |
| `src/components/teams/TeamsBoards.vue`      | 1–2   | render `TeamModeControls`; wrap gating                               |
| `src/components/teams/TeamModeControls.vue` | 1–3   | **new** — picker + label; then Save/Save-as-New; then Export/Import  |
| `src/components/teams/BoardsRow.vue`        | 1     | verify/document 1-/3-board no-op of wrap CSS                         |
| `src/stores/teamLibrary.ts`                 | 2–3   | **new** — library state + persistence (logic in lib)                 |
| `src/components/grid/BoardThumbnail.vue`    | 2     | **new** — shared SVG board renderer (portraits)                      |
| `src/components/grid/ArenaPreviewGrid.vue`  | 2     | refactor to render through `BoardThumbnail`                          |
| `src/components/teams/TeamPreview.vue`      | 2     | **new** — saved-team thumbnail (decode → BoardThumbnails)            |
| `src/components/teams/SavedTeamsList.vue`   | 2     | **new** — cards + actions + Delete all                               |
| `src/components/teams/TeamsRoster.vue`      | 2     | fourth tab (`saved`, badge)                                          |
| `src/components/ui/IconSave.vue`            | 2     | **new**                                                              |
| `src/locales/app/*.json`                    | 1–3   | ~20 new keys (en + zh)                                               |
| `src/views/ShareView.vue`                   | 4     | wrap gating for non-5-board payloads (cosmetic)                      |
| `tests/unit/…`                              | 1–3   | new suites per phase; regression test §5-P1-9                        |
| `docs/architecture/…`                       | 4     | GRID.md, URL_SERIALIZATION.md updates; serializer comment fix        |

## Appendix B — localStorage schema after this design

```
stargazer.arena                     (unchanged) binary-encoded Arena state
stargazer.teams.mode                '1v1' | '3v3' | '5v5' | '5v5sl'
stargazer.teams.active.1v1          { v: 1, data: <encoded MultiGridState>, sourceId: string | null }
stargazer.teams.active.3v3          { v: 1, data: …, sourceId: … }
stargazer.teams.active.5v5          { v: 1, data: …, sourceId: … }
stargazer.teams.active.5v5sl        { v: 1, data: …, sourceId: … }
stargazer.teams.saved               { v: 1, teams: SavedTeam[] }        (≤ 200 teams)
stargazer.teams                     (legacy) deleted unread on first visit
```
