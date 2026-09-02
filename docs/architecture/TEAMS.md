# Teams

## Overview

The Teams page (`/teams`) is a mode-driven multi-board team builder: a registry entry selects how many boards are live (1v1, 3v3, 5v5, 5v5 Supreme League) and each mode persists its own active team independently. On top sits the saved-team library: named canonical snapshots with portrait thumbnails that can be loaded, updated, duplicated, renamed, deleted, and backed up to a JSON file.

## Design Principles

1. **One format everywhere**: live boards, autosave slots, share links, backup files, and saved teams all serialize to the same encoded `MultiGridState` string
2. **Mode is data, not a tab**: one registry (`TEAM_MODES`) and one orchestrator reconfigure the single board array; there are never two writers to the live boards
3. **One slot per mode**: each mode autosaves to its own versioned localStorage envelope, so switching modes is lossless by construction
4. **One restore path**: every whole-board apply (slot restore, mode switch, saved-team load, `?g=` ingress) goes through `restoreMultiFromEncodedState`; the side-load merge is deliberately an engine-primitive edit instead (see Side Loading)
5. **Canonical team data**: saved-team payloads are viewer-state-free with fixed key order, so equal content is byte-equal

## Architecture

```
┌────────────────────────── TeamsView ───────────────────────────┐
│ tab state · display flags · save/load handlers                 │
└──────────┬────────────────────────────────────┬────────────────┘
           ▼                                    ▼
┌─ TeamsBoards ──────────────┐    ┌─ TeamsRoster ────────────────┐
│ - GridControls + picker    │    │ - characters/seasonal/maps   │
│   and team save actions    │    │ - SavedTeamsList (default)   │
│ - BoardsRow → GridBoard ×N │    │   → TeamPreview thumbnails   │
└──────────┬─────────────────┘    └──────────────┬───────────────┘
           ▼                                     ▼
┌─ useTeamsRestore ──────────────────┐    ┌─ teamLibrary ────────┐
│ - switch/load/?g= sequences        │    │ - SavedTeam records  │
│ - useTeamsPersistence (mode slots) │    │ - import/export      │
└──────────┬─────────────────────────┘    └──────────────────────┘
           ▼ useGrids: N GridContexts (see GRID.md)
```

## Page Composition

### TeamsView (`/src/views/TeamsView.vue`)

The page orchestrator: an outer TabView (Teams grid / Image Stitcher, the latter hidden on mobile) inside one card, with the roster as a sibling card.

- **Display flags**: owns the view toggles (skills, perspective, team view, invert, wrap) as device-level preferences shared by every team mode: restored from `stargazer.teams.display` at setup and mirrored on every change. Share links serialize them and a `?g=` restore applies them (adopting the sharer's view is the point of a link); mode slots also carry them but restores ignore them entirely. Grid info visibility is separate: the `gridInfo` slice of `stargazer.prefs` (`useGridInfoPrefs`, shared with the Arena and ShareView), derived into an effective `info` object threaded to the boards, never serialized into links
- **Board sizing**: pins its own hex size per breakpoint (`/src/utils/teamsBoardSize.ts`)
- **Startup**: a `?g=` link overwrites the routed mode's slot; otherwise the last-used mode restores
- **Degraded startup**: if game data failed to load, `buildDefaults()` shows placeholder boards with no persistence reads or writes
- **Teardown**: resets to the Arena's single board synchronously on leave (`onScopeDispose`)

### TeamsBoards (`/src/components/teams/TeamsBoards.vue`)

The grid panel: a document-style title line, a two-row control bar (`GridControls` with teams content slotted in), then a horizontally scrolling row of boards, each bound to its own `GridContext`.

- **Title line**: the source team's name (or "Unsaved team") as plain centered text, with a dot + "Unsaved changes" beside it while the boards differ from the saved copy
- **Row 1 (configure)**: mode picker, then the display toggles (wrap, the Grid Info split chip with its children popover, skills, syn, flat, invert, team view)
- **Row 2 (act)**: team actions and the side-load menu, then the share actions (link, copy, download, clear)
- **Per-board actions**: swap (drag to reorder, via `useGridSwap`), copy image, download image, clear
- **Wrap**: the 3-2 two-row boards layout; rendered for 5-board modes on desktop only (every consumer gates on `canWrap` / board count, so the preference survives visits to non-wrap modes), serialized with the display flags
- **Syn**: the friend-assist toggle (see [Grid](./GRID.md), unit id namespaces); offered only on modes with `allowSynergy` (1v1), and never serialized: it is derived from board content on every restore, and unchecking removes the placed synergy units

### TeamModePicker (`/src/components/teams/TeamModePicker.vue`)

Segmented `aria-pressed` toggle buttons in `TEAM_MODE_ORDER`, slotted at the head of the toggles row.

### TeamSaveActions (`/src/components/teams/TeamSaveActions.vue`)

The team half of the action row, in File-menu order (New, Save, Save as New), collapsing to round icons on mobile. Every action here targets the team on the boards; library-wide backup lives in the Saved Teams tab, next to the library it acts on:

- **New**: fresh default boards, detached from any saved team
- **Save actions**: Save, and Save as New with a name popover (Enter commits, Esc cancels)

### TeamsRoster (`/src/components/teams/TeamsRoster.vue`)

A desktop card below the boards / a mobile pull-up sheet:

- **Tabs**: characters, seasonal, and maps act on the active board; saved teams manages the library and is the default tab
- **Load**: applies a whole team (all boards, switching mode if needed) and collapses the sheet
- **Badge**: the saved-teams tab shows the library count
- **Library bar**: Import / Export / Delete all sit in the saved-teams panel, since all three act on the library rather than the boards. `SavedTeamsList` owns them outright (store calls plus its own toasts), so no handler threads back through `TeamsRoster`. Export and Delete all hide at zero teams; Import stays, because restoring into an empty library is its main use
- **Filtered export**: Export follows the Mode / One-side / Search filters. With none active it backs up the whole library silently; with any active it writes only the teams shown: the button relabels to the shown count ("Export 3 of 20"), the hover tooltip names the criteria, and an info toast confirms the count and criteria afterwards ("Exported 3 of 20 teams matching 3v3 and “Kelsey”"), so a partial backup can't pass for a full one. A filter that matches nothing exports nothing and raises the no-matches message as an error toast

Placement modes (on-grid popup vs. cell-tap flow) and the shared `BottomSheet` are covered in GRID.md.

### ImageStitcher (`/src/components/teams/ImageStitcher.vue`)

A standalone tool tab: drop exported board images in, reorder them, and stitch them into one canvas (direction and fit settings) for download.

## Team Modes

`/src/lib/teams/modes.ts` is the single source of truth:

```typescript
TEAM_MODES: Record<TeamModeKey, TeamModeConfig>
// key, labelKey (i18n), boardCount, defaultMaps (length === boardCount), canWrap, allowSynergy
TEAM_MODE_ORDER // picker order, ascending board count
DEFAULT_TEAM_MODE = '5v5sl'
```

- **Default maps**: seed fresh slates and pad short crafted links; 1v1/3v3/5v5 default every board to `arena1`, Supreme League uses the season's map list (`FIVE_V_FIVE_DEFAULT_MAPS` in `/src/lib/maps.ts`)
- **Defaults fingerprint**: each active slot records its mode's default maps at write time; changing the list (a new Supreme League season) invalidates the slot on next load: a deliberate hard reset, with saved teams untouched
- **`t` is authoritative**: serialized tile states are self-sufficient (restore resets all tiles and replays `t`), so records referencing retired maps still restore, preview, and re-export; map configs are needed only for empty boards and the Maps-tab picker
- **`resolveTeamMode(state)`**: a declared `mode` is honored only when its board count matches; otherwise the count decides (5 boards → Supreme League, else the smallest fitting mode)
- **`normalizeTeamPayload`**: truncates/pads a payload to the mode's exact shape and strips the `y` (synergy) section on modes without `allowSynergy`, since a crafted synergy unit would bypass the page-wide duplicate repair. Runs on every teams-page ingress (slot restore, saved-team load, `?g=`); `/share` renders payloads as-is
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
3. Normalize and restore the new mode's slot (the restore rebuilds the boards) or build the mode's defaults; exactly one rebuild, always (equal-count modes still differ in maps and state). A slot restore ignores the payload's display flags: view toggles are device prefs
4. Clear board-qualified selection, re-assert page sizing
5. Adopt the slot's `sourceId`, normalized through the library (unresolvable → null)
6. Resume autosave, write the baseline

A `?g=` link resolves its mode first, then normalizes and applies through the same path with `sourceId = null`, overwriting the routed mode's slot (a shared link is nobody's saved team). A link that fails to decode or apply falls back to the saved slot, which autosave then cannot wipe.

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
- **Seasonal ids unchecked**: a record referencing retired phantimals/artifacts stays valid and lossless; boards render question-mark placeholders (removable/replaceable like live units) and thumbnails a question-marked dot for units (an unresolvable artifact is omitted instead), and the ids persist until the user edits them away
- **Canonical at the owner**: `saveAsNew`/`update` canonicalize their input rather than trusting callers
- **`updatedAt` is content-only**: `update` stamps it, `rename` does not, so the last-modified sort and the card's "updated" label track board edits rather than relabels
- **Serializer contract**: canonicalization rebuilds each board from `BOARD_CONTENT_KEYS` (exported beside `BoardState`, contract-tested), so a new `GridState` section must be registered there to survive in saved teams
- **Concurrency**: mutations re-read the stored blob first (read-modify-write); cross-tab sync is out of scope beyond that
- **Layering**: the store returns typed results and never toasts; components own user feedback
- **Cap**: `MAX_SAVED_TEAMS` (200, ≈ 6 KB per full team)

Semantics wired in `TeamsView`:

- **New**: rebuilds the mode's default boards and detaches provenance, so Save can no longer overwrite the previous source (Clear only empties content and keeps the tie)
- **Save**: updates the source team in place; with no source it degrades to **Save as New**, whose popover names a new record and adopts it as the source
- **Load**: switches to the team's mode, applies its content (normalized like every ingress), and repoints `sourceId`; viewer display toggles stay untouched
- **Loaded badge**: the card matching `sourceId` gets a border ring, the same provenance the unsaved-changes indicator reads
- **Copy / Download**: exports the card's thumbnail as a PNG via `useThumbnailExport`, which serializes the boards' SVGs and rasterizes them onto one canvas (WebKit fails on DOM-snapshot capture of SVG content, and the vectors upscale losslessly to full-grid resolution)
- **Preview**: clicking a card's thumbnail opens `TeamPreviewModal`, the same `TeamPreview` at modal scale (`large`) on the shared modal surface, a read-only look at the team without loading it
- **Dirty**: `canonicalTeamData(live snapshot) !== source.data`; board clicks and display toggles never trip it
- **Delete / Delete all**: two-step inline confirm; deleting the source reverts the label to "Unsaved team"
- **Sort**: last-modified first (default) or by name (locale-aware, numeric so "Team 2" precedes "Team 10"); the choice persists per device (`stargazer.teams.sort`)
- **Mode**: segments for All plus every key in `TEAM_MODE_ORDER`, always shown. Offering the full list rather than only the modes present keeps a segment from disappearing with its last team and stranding the selection; an empty mode reaches the same "no matches" state a query does. Narrows the list before the search query runs, and unlike Sort it is deliberately not persisted
- **One-side**: a toggle after the mode segments, narrowing the list to teams the Load menu can side-load (`savedTeamSide`, every unit on one team) before the search query runs; like Mode, deliberately not persisted
- **Search**: a filter in the library bar, shown only with 2+ teams (hiding it also clears the query, so it can't reappear pre-filtered). A card stays visible when the query hits its name (`renderSnippet` marks the hit in the title) or, at 2+ characters, a hero on its boards (`matchCharacterNames`, the roster search's multi-locale name index), whose hexes get a ring in the thumbnail. Phantimals and companion summons never match; per-record hero sets are memoized off the immutable `data` string. The matching lives in `useSavedTeamSearch`, shared with the Load menu

## Side Loading (Load Menu)

`TeamLoadMenu` (`/src/components/teams/TeamLoadMenu.vue`), slotted beside the save actions, stamps a saved one-side team onto the live boards without touching the other side:

- **Eligibility**: a record qualifies when every unit on every board (heroes, companions, phantimals, synergy units) belongs to one team, and at least one unit exists; the rule spans the whole record, never a single board (`savedTeamSide` in `/src/lib/teams/sideLoad.ts`, memoized per record)
- **Two groups, two scopes**: the active mode's teams load board-for-board; a second group offers 1v1 teams in every other mode, loading onto the active board only. Active-board loads skip heroes already on the destination team of another board (page-wide uniqueness) and count them in the toast
- **Load**: `buildSideLoadPlan` maps the record to per-board `{ mains, companions, phantimal, artifact }` (the synergy hero rides in `mains` only when the destination mode has the Syn affordance), and `grids.loadTeamSide` clears the destination side via per-hex removal (the delete path: skill cleanup, companion cascade), then places each unit on its saved hex, falling back to a random destination tile when the live map assigns that tile elsewhere or something already stands there (a stamp never replaces, so it can't evict this load's own work). Companions spawn from their main's skill and are settled onto their saved hexes per main, the same anti-squatting pass the bulk restore runs; an unreachable target leaves the companion at its spawn tile. Paragon is written for every placed hero (saved level or 0, so a stale level can't attach to the incomer), phantimals place after mains (their faction gate needs the roster), the side's artifact is carried, and the phantimal baseline re-seeds so a deliberately phantimal-less save stays that way
- **Invert**: flips the destination team and 180-rotates every saved hex (`rotatedHexId` in `/src/lib/grid.ts`: cube-coordinate negation, `46 - hexId` on the full arena), with the same random fallback
- **Confirm**: a load that would remove anything (units or the destination side's artifact) arms the two-step inline confirm; an empty destination loads in one click
- **Deliberately not a restore**: the load is a one-side merge composed from engine primitives, so it bypasses `restoreMultiFromEncodedState` (which replaces whole boards); `sourceId`, maps, and display flags stay untouched, and the edit surfaces as normal unsaved changes that autosave persists

## Thumbnails

`BoardThumbnail` (`/src/components/grid/BoardThumbnail.vue`) renders any map + unit set as pure data → SVG:

- **Geometry cache**: hex polygons are memoized at module level per hex size, so a full library renders hundreds of boards from one polygon set
- **Map-state cache**: baseline tile states are memoized per map key
- **Portraits**: hex-clipped `<image>`s with a team-colored ring (dot fallback for unresolvable units); `clipPath` defs exist only for occupied hexes; companion ids resolve through `gameData.getCharacterImageNameById` (the skill's custom companion image or the main hero's portrait); synergy units (`y`, local ids) resolve exactly like `c` entries
- **Artifacts**: the ally/enemy ids from the record's `a` section, drawn as circle-clipped `<image>`s with a team-colored ring on the artifact host cells (`artifactHostHex` in `/src/lib/grid.ts`: left of hex 1, right of hex 45, the same cells `GridArtifacts` and artifact arrows anchor on). Those cells fall in the empty corners of the hex grid's bounding box, so showing them costs no framing change. `TeamPreview` resolves the icons with ArtifactImage's local/remote split; an id that no longer resolves draws nothing
- **Tiles from `t`**: `TeamPreview` decodes a record once (`/src/lib/teams/preview.ts`) and renders each board from the record's own tile states, exactly what Load produces; the map-config baseline applies only when a board has no `t`
- **Reuse**: `ArenaPreviewGrid` (Maps tab + Map Editor preset picker) renders through the same component with its square framing

The saved-teams panel is the roster's default tab; its cards use `content-visibility: auto`, so a full library never taxes page load.

## Backup Files

Driven from the Saved Teams tab's library bar (see TeamsRoster above); a file holds the whole library or, with a filter active, only the filtered view. `/src/lib/teams/transfer.ts` builds and parses the export envelope (`{ app, kind, version, exportedAt, teams }`). Import is merge-only: a malformed envelope rejects wholesale; records re-validate and canonicalize; duplicates of existing teams (canonical data + name) and in-file duplicates are skipped; accepted records keep the file's ids so identity survives a round trip, regenerating only when an id is overlong or already taken — and a record whose id belongs to an existing team (an old export of it, edited since) additionally imports under an "(imported)"-marked name and counts as a conflict in the import toast; cap overflow counts as skipped. "Replace everything" is Delete all + Import.

## Sharing & Image Export

- **Link**: copies a read-only `/share` URL built from the same persistence snapshot autosave writes; `/share` shows the wrap layout only for 5-board payloads, and its Edit action reopens `/teams` with the payload applied
- **Copy / Download**: captures the full boards track as one image through `useGridExport` (scrolled-out boards included, per-board action buttons filtered out)
- **Per-board copy/download**: each board's own actions export just that board

## Related Documentation

- [`/docs/architecture/GRID.md`](./GRID.md) - Multi-board store, grid contexts, placement modes, bottom sheet
- [`/docs/architecture/URL_SERIALIZATION.md`](./URL_SERIALIZATION.md) - The `MultiGridState` codec, mode field, canonical form
- [`/docs/architecture/DRAG_AND_DROP.md`](./DRAG_AND_DROP.md) - Cross-board character and artifact drag
