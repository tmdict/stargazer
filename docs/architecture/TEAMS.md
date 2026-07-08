# Teams

## Overview

The Teams page (`/teams`) is a mode-driven multi-board team builder: a registry entry selects how many boards are live (1v1, 3v3, 5v5, 5v5 Supreme League) and each mode persists its own active team independently. On top sits the saved-team library — named canonical snapshots with portrait thumbnails that can be selected, updated, duplicated, renamed, deleted, and backed up to a JSON file.

## Design Principles

1. **One format everywhere**: live boards, autosave slots, share links, backup files, and saved teams all serialize to the same encoded `MultiGridState` string
2. **Mode is data, not a tab**: one registry (`TEAM_MODES`) and one orchestrator reconfigure the single board array; there are never two writers to the live boards
3. **One slot per mode**: each mode autosaves to its own versioned localStorage envelope, so switching modes is lossless by construction
4. **One restore path**: every bulk apply (slot restore, mode switch, saved-team select, `?g=` ingress) goes through `restoreMultiFromEncodedState`
5. **Canonical team data**: saved-team payloads are viewer-state-free with fixed key order, so equal content is byte-equal

## Architecture

```
┌────────────────────────── TeamsView ───────────────────────────┐
│ tab state · display flags · save/select/import/export handlers │
└──────────┬────────────────────────────────────┬────────────────┘
           ▼                                    ▼
┌─ TeamsBoards ──────────────┐    ┌─ TeamsRoster ────────────────┐
│ - TeamModeControls         │    │ - characters/seasonal/maps   │
│ - GridControls (flags)     │    │ - SavedTeamsList (lazy)      │
│ - BoardsRow → GridBoard ×N │    │   → TeamPreview thumbnails   │
└──────────┬─────────────────┘    └──────────────┬───────────────┘
           ▼                                     ▼
┌─ useTeamsRestore ──────────────────┐    ┌─ teamLibrary ────────┐
│ - switch/select/?g= sequences      │    │ - SavedTeam records  │
│ - useTeamsPersistence (mode slots) │    │ - import/export      │
└──────────┬─────────────────────────┘    └──────────────────────┘
           ▼ useGrids: N GridContexts (see GRID.md)
```

## Page Composition

### TeamsView (`/src/views/TeamsView.vue`)

The page orchestrator: an outer TabView (Teams grid / Image Stitcher — hidden on mobile) inside one card, with the roster as a sibling card.

- **Display flags**: owns the global toggles (arrows, grid info, skills, perspective, wrap); share links serialize them and a URL restore applies them
- **Board sizing**: pins its own hex size per breakpoint (`/src/utils/teamsBoardSize.ts`)
- **Startup**: a `?g=` link overwrites the routed mode's slot; otherwise the last-used mode restores
- **Degraded startup**: if game data failed to load, `buildDefaults()` shows placeholder boards with no persistence reads or writes
- **Teardown**: resets to the Arena's single board synchronously on leave (`onScopeDispose`)

### TeamsBoards (`/src/components/teams/TeamsBoards.vue`)

The grid panel: mode row, global control bar, and a horizontally scrolling row of boards, each bound to its own `GridContext`.

- **Per-board actions**: swap (drag to reorder, via `useGridSwap`), copy image, download image, clear
- **Wrap**: the 3-2 two-row layout; 5-board modes on desktop only, serialized with the display flags

### TeamModeControls (`/src/components/teams/TeamModeControls.vue`)

The mode row above the control bar:

- **Mode picker**: segmented `aria-pressed` toggle buttons in `TEAM_MODE_ORDER`
- **Active-team label**: source team name or "Unsaved team", with a content-dirty dot
- **Save actions**: Save, and Save as New with a name popover (Enter commits, Esc cancels)
- **Backup actions**: Export, and Import through a hidden file input

### TeamsRoster (`/src/components/teams/TeamsRoster.vue`)

A desktop card below the boards / a mobile pull-up sheet:

- **Tabs**: characters, seasonal, and maps act on the active board; saved teams manages the library
- **Select**: loads a whole team (all boards, switching mode if needed) and collapses the sheet
- **Badge**: the saved-teams tab shows the library count

Placement modes (on-grid popup vs. cell-tap flow) and the shared `BottomSheet` are covered in GRID.md.

### ImageStitcher (`/src/components/teams/ImageStitcher.vue`)

A standalone tool tab: drop exported board images in, reorder them, and stitch them into one canvas (direction and fit settings) for download.

## Team Modes

`/src/lib/teams/modes.ts` is the single source of truth:

```typescript
TEAM_MODES: Record<TeamModeKey, TeamModeConfig>
// key, labelKey (i18n), boardCount, defaultMaps (length === boardCount), canWrap
TEAM_MODE_ORDER // picker order, ascending board count
DEFAULT_TEAM_MODE = '5v5sl'
```

- **Default maps**: seed fresh slates and pad short crafted links; 1v1/3v3/5v5 default every board to `arena1`, Supreme League uses the season's map list
- **Defaults fingerprint**: each active slot records its mode's default maps at write time; changing the list (a new Supreme League season) invalidates the slot on next load — a deliberate hard reset, with saved teams untouched
- **`t` is authoritative**: serialized tile states are self-sufficient (restore resets all tiles and replays `t`), so records referencing retired maps still restore, preview, and re-export; map configs are needed only for empty boards and the Maps-tab picker
- **`resolveTeamMode(state)`**: a declared `mode` is honored only when its board count matches; otherwise the count decides (5 boards → Supreme League, else the smallest fitting mode)
- **`normalizeTeamPayload`**: truncates/pads a payload to the mode's exact shape (teams-page ingress only; `/share` renders payloads as-is)
- **Modes are add-only**: removing a mode key would orphan its slot and saved teams

## Per-Mode Persistence

`useTeamsPersistence` (`/src/composables/useGridPersistence.ts`) writes an `ActiveSlot` envelope per mode:

```text
stargazer.teams.mode                 last-used TeamModeKey
stargazer.teams.active.<mode>        { v: 1, data: <encoded MultiGridState>, sourceId, defaults }
stargazer.teams.saved                { v: 1, teams: SavedTeam[] }
stargazer.teams.saved.backup         an unknown-version library blob, preserved before v1 writes
```

`sourceId` is the saved team the active boards were loaded from / last saved to (null = unsaved); `defaults` is the fingerprint above. Unknown envelope versions and undecodable payloads are treated as absent. The autosave watcher (one per page instance) routes writes to the live mode's slot; `flush()` is inert until `startAutosave()` marks the instance as the slot's writer, so a degraded page can never overwrite a slot.

`useTeamsRestore` (`/src/composables/useTeamsRestore.ts`) owns every switch, applying payloads through `restoreMultiFromEncodedState` (per-board apply order, companion settling, cross-board dedupe, phantimal baseline re-seeding):

1. Pause autosave, flush the old mode's slot
2. Set + persist the new mode
3. Restore the new mode's slot (the restore rebuilds the boards) or build the mode's defaults — exactly one rebuild, always (equal-count modes still differ in maps and state)
4. Clear board-qualified selection, force wrap off for non-wrap modes, re-assert page sizing
5. Adopt the slot's `sourceId`, normalized through the library (unresolvable → null)
6. Resume autosave, write the baseline

A `?g=` link resolves + normalizes first, then applies through the same path with `sourceId = null`, overwriting the routed mode's slot (a shared link is nobody's saved team). A link that fails to decode or apply falls back to the saved slot, which autosave then cannot wipe.

## Saved-Team Library

`useTeamLibrary` (`/src/stores/teamLibrary.ts`) holds `SavedTeam` records (`/src/lib/teams/savedTeam.ts`):

```typescript
interface SavedTeam {
  id: string
  name: string // ≤ MAX_TEAM_NAME_LENGTH (60)
  mode: TeamModeKey
  data: string // canonical encoded MultiGridState
  createdAt: number
  updatedAt: number
}
```

Key rules:

- **Validation**: hydration and import run every record through `validateSavedTeam` (known mode, matching board count, canonicalizable data); a failing record drops alone, never the library
- **Map keys unchecked**: `t` is authoritative, so a record referencing a retired map stays valid
- **Canonical at the owner**: `saveAsNew`/`update` canonicalize their input rather than trusting callers
- **Serializer contract**: canonicalization rebuilds each board from `BOARD_CONTENT_KEYS` (exported beside `BoardState`, contract-tested), so a new `GridState` section must be registered there to survive in saved teams
- **Concurrency**: mutations re-read the stored blob first (read-modify-write); cross-tab sync is out of scope beyond that
- **Layering**: the store returns typed results and never toasts; components own user feedback
- **Cap**: `MAX_SAVED_TEAMS` (200, ≈ 6 KB per full team)

Semantics wired in `TeamsView`:

- **Save**: updates the source team in place; with no source it degrades to **Save as New**, whose popover names a new record and adopts it as the source
- **Select**: switches to the team's mode, applies its content, and repoints `sourceId`; viewer display toggles stay untouched (canonical data has no `d`)
- **Dirty**: `canonicalTeamData(live snapshot) !== source.data` — board clicks and display toggles never trip it
- **Delete / Delete all**: two-step inline confirm; deleting the source reverts the label to "Unsaved team"

## Thumbnails

`BoardThumbnail` (`/src/components/grid/BoardThumbnail.vue`) renders any map + unit set as pure data → SVG:

- **Geometry cache**: hex polygons are memoized at module level per hex size, so a full library renders hundreds of boards from one polygon set
- **Map-state cache**: baseline tile states are memoized per map key
- **Portraits**: hex-clipped `<image>`s with a team-colored ring (dot fallback for unresolvable units); `clipPath` defs exist only for occupied hexes
- **Tiles from `t`**: `TeamPreview` decodes a record once (`/src/lib/teams/preview.ts`) and renders each board from the record's own tile states — exactly what Select produces; the map-config baseline applies only when a board has no `t`
- **Reuse**: `ArenaPreviewGrid` (Maps tab + Map Editor preset picker) renders through the same component with its square framing

The saved-teams panel mounts on first activation and its cards use `content-visibility: auto`, so a full library never taxes page load.

## Backup Files

`/src/lib/teams/transfer.ts` builds and parses the export envelope (`{ app, kind, version, exportedAt, teams }`). Import is merge-only: a malformed envelope rejects wholesale; records re-validate and canonicalize; duplicates of existing teams (canonical data + name) and in-file duplicates are skipped; accepted records get fresh ids; cap overflow counts as skipped. "Replace everything" is Delete all + Import.

## Sharing & Image Export

- **Link**: copies a read-only `/share` URL built from the same persistence snapshot autosave writes; `/share` shows the wrap layout only for 5-board payloads, and its Edit action reopens `/teams` with the payload applied
- **Copy / Download**: captures the full boards track as one image through `useGridExport` (scrolled-out boards included, per-board action buttons filtered out)
- **Per-board copy/download**: each board's own actions export just that board

## Related Documentation

- [`/docs/architecture/GRID.md`](./GRID.md) - Multi-board store, grid contexts, placement modes, bottom sheet
- [`/docs/architecture/URL_SERIALIZATION.md`](./URL_SERIALIZATION.md) - The `MultiGridState` codec, mode field, canonical form
- [`/docs/architecture/DRAG_AND_DROP.md`](./DRAG_AND_DROP.md) - Cross-board character and artifact drag
