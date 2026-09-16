# Teams

## Overview

The Teams page (`/teams`) is a mode-driven multi-board team builder: a mode is a board count (1v1, 3v3, 5v5) and each mode persists its own active team independently. Within a mode, a type (Supreme League, Guild Duel) is a named per-board map list; it is read off the live boards' maps and never stored. On top sits the saved-team library: named canonical snapshots with portrait thumbnails that can be loaded whole or one side at a time, updated, duplicated, renamed, deleted, and backed up to a JSON file.

## Design Principles

1. **One interchange format**: live boards, autosave slots, backup files, and saved teams all serialize to the same encoded `MultiGridState` string; share links re-encode that content in the compact binary link format (see [URL Serialization](./URL_SERIALIZATION.md))
2. **Mode is data, not a tab**: one registry (`TEAM_MODES`) and one orchestrator reconfigure the single board array; there are never two writers to the live boards
3. **One slot per mode**: each mode autosaves to its own versioned localStorage envelope, so switching modes is lossless by construction
4. **One restore path**: every whole-board apply (slot restore, mode switch, saved-team load, `?g=` ingress) goes through `restoreMultiFromEncodedState`; the side-load merge and the match import are engine-primitive edits instead (see Side Loading, Team Import)
5. **Canonical team data**: saved-team payloads are viewer-state-free with fixed key order, so equal content is byte-equal; equality comparisons go through `teamContentKey`, which additionally ignores the `season` stamp on seasonal-free teams (a reused seasonal id names different content each season, so the stamp counts exactly when seasonal refs exist)
6. **Type is derived, never stored**: a type is an ordered exact match of the boards' map keys against `TEAM_VARIANTS`; nothing about it reaches the JSON payload, the wire, or a storage key. An in-game mode on an existing board count is a registry row plus a label file, and a season rotation edits that row and resets nothing

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

The page orchestrator: an outer TabView (Teams grid / Image Stitcher, the latter hidden on mobile) with the roster as a sibling card.

- **Display flags**: the view toggles (skills, perspective, team view, invert, wrap) are device-level preferences shared by every team mode: restored from `stargazer.teams.display` (the same packed byte as the link `d` field) at setup and mirrored on every change. Share links serialize them and a `?g=` restore applies them (adopting the sharer's view is the point of a link); mode slots also carry them but slot and saved-team restores ignore them entirely
- **Grid info**: separate from the display flags. Visibility is the `gridInfo` slice of `stargazer.prefs` (`useGridInfoPrefs`, shared with the Arena and ShareView), derived into an effective `info` object threaded to the boards, and never serialized into links
- **Board sizing**: pins its own hex size per breakpoint (`/src/utils/teamsBoardSize.ts`, `hexSizeMode = 'fixed-medium'`)
- **Startup**: a `?g=` link overwrites the routed mode's slot; otherwise the last-used mode restores. If game data failed to load, `buildDefaults()` shows placeholder boards with no persistence reads or writes
- **Teardown**: resets to the Arena's single board in `onScopeDispose`, which runs synchronously on unmount so an HMR reload cannot leave the board count clobbered
- **Copy Link**: decodes the persistence snapshot once and re-encodes it as a binary link (`encodeMultiGridStateToLinkUrl`) for `useShareLink`; Copy / Download capture the full `.boards-track` (scrolled-out boards included), with `capture-exclude` chrome filtered out by `useGridExport`

### TeamsBoards (`/src/components/teams/TeamsBoards.vue`)

The grid panel: title line, `GridControls` with the teams controls slotted in (`TeamModePicker`, `TeamVariantPicker`, `TeamSaveActions`, `TeamLoadMenu`, `TeamImportButton`), and the boards row, each board bound to its own `GridContext`.

- **Type picker**: Default plus the mode's named types, shown only for a board count that has any (1v1 has none). The lit option is the live match (`useTeamsRestore.variant`), so hand-picked maps light nothing. Selecting rebuilds every board on the chosen list through the same `rebuildOn` New uses, which drops their content, so it confirms two-step whenever a board holds a unit or an artifact (`grids.boardsHaveContent`). The armed key is scoped to the mode and the picker disarms whenever the match or the source team changes, so an armed click can never confirm against boards other than the ones it was armed for; New in `TeamSaveActions` disarms on the same signals

- **Title line**: the source team's name (renamable inline), a match import's pending name, or "Unsaved team", with a dot beside it while the boards differ from the saved copy
- **Wrap**: the 3-2 two-row boards layout, rendered for 5-board modes on desktop only. Every consumer gates on `canWrap` / board count, so the preference survives visits to non-wrap modes; a stray wrap bit in a payload needs no reset
- **Syn**: the friend-assist toggle (see [Grid](./GRID.md), unit id namespaces); offered only on modes with `allowSynergy` (1v1), and never serialized: `grids.deriveSynergy()` re-derives it from board content on every restore, and unchecking removes the placed synergy units (`grids.setSynergy`)
- **Per-board actions**: swap by drag (`useGridSwap`), copy / download image, and clear behind the two-step armed confirm every destructive control uses (`useArmedConfirm`)
- **TeamSaveActions**: File-menu order (New, Save, Save as New); Save degrades to Save as New with no source, whose popover commits on Enter and cancels on Esc. Library-wide backup lives in the Saved Teams tab, beside the library it acts on

### TeamPowerPanel and TeamPowerDock (`/src/components/grid/`)

The per-board hero panel (portraits with paragon / refinement pills, the side's Rivalry stat) and its upgrade-edit dock. Both mount under Grid Info's Hero card toggle in `GridBoard` on Teams and `HomeView` on the Arena; `/share` mounts the panel read-only and no dock.

- **One layer choice per page**: `useAttrLayerSelection` is a module singleton, so a chip (ALL / P / R) picked on any dock flips every dock and panel. The effective layers are the choice restricted to the visible ones (a hidden single choice falls back to the visible layers); the Grid Info "Upgrades" toggle shows both layers or none, so with it off nothing is editable. The lit chip is derived from the effective set, so it always equals what a tap will edit
- **Tap to edit**: a single layer steps up by one and wraps from max to 0. ALL raises every layer by one, clamped at max, and wraps them all to 0 together only once every layer is maxed, so two counters at different values can never desync. Taps are disabled on read-only pages and while Upgrades is off
- **Per-team clear**: `clearTeam` removes the side's units, their upgrade-attr records, and the side's artifact, so an evicted hero placed later cannot resurrect its old levels
- **Rivalry stat**: `teamPowerNet` (`/src/lib/characters/paragon.ts`), driven by paragon alone. Each hero grants its team equal Inspiration and Intimidation, so a side's net is its total minus the enemy's and the two sides always mirror; the label disappears at 0

### TeamsRoster (`/src/components/teams/TeamsRoster.vue`)

A desktop card below the boards / a mobile pull-up sheet. The characters, seasonal, and maps tabs act on the active board; saved teams (the default tab, badged with the library count) manages the library, and Load collapses the sheet so the loaded boards show. Placement modes and the shared `BottomSheet` are covered in GRID.md.

`SavedTeamsList` (`/src/components/teams/SavedTeamsList.vue`) owns the library bar outright (store calls plus its own toasts):

- **Import / Export / Delete all**: sit in this panel because all three act on the library, not the boards. Export and Delete all hide at zero teams; Import stays, since restoring into an empty library is its main use
- **Filtered export**: Export follows the Mode / Type / One-sided / Search filters. With none active it backs up the whole library silently; with any active it writes only the teams shown, relabels to the shown count, names the criteria in the tooltip, and confirms count and criteria in a toast afterwards (`app.export-filtered`), so a partial backup cannot pass for a full one. A filter that matches nothing exports nothing and raises the no-matches error
- **Sort**: last-modified first (default) or by name (locale-aware, numeric so "Team 2" precedes "Team 10"), persisted per device (`stargazer.teams.sort`)
- **Mode filter**: All plus every key in `TEAM_MODE_ORDER`, always offered so a segment cannot vanish with its last team and strand the selection. Deliberately not persisted: a filter restored on load would read as missing teams
- **Type filter**: a second, wrapping chip row (All, Default, the mode's types) shown only while the mode filter names a board count with types; it resets to All on every mode-filter change, since a type belongs to one board count. Records are classified by `teamVariant` (memoized on the data string) against the current registry, so a rotation moves old records out of the type without touching them
- **One-sided filter**: teams the Load menu can side-load (`savedTeamSide`); not persisted, for the same reason
- **Search**: `useSavedTeamSearch` (shared with the Load menu): a name hit at any length, or at 2+ characters a hero on the boards (`matchCharacterNames`, the roster's multi-locale index), whose hexes get a ring in the thumbnail. Phantimals and companion summons never match. The box shows only with 2+ teams, and hiding it clears the query so the list cannot strand on "no matches"
- **Filter order**: sort, then mode, then type, then one-sided, then search

## Team Modes and Types

`/src/lib/teams/modes.ts` is the single source of truth:

```typescript
TEAM_MODES: Record<TeamModeKey, TeamModeConfig>
// key, labelKey, boardCount, defaultMaps (length === boardCount), initialVariant?, canWrap, allowSynergy
TEAM_VARIANTS: Record<TeamVariantKey, TeamVariantConfig>
// key, mode, labelKey, maps (length === the mode's boardCount)
TEAM_MODE_ORDER // picker order, ascending board count
DEFAULT_TEAM_MODE = '5v5'
```

- **A mode is a board count**: counts are unique across `TEAM_MODES`, so a mode key, a board count, a slot and a wire id name the same thing. A new mode exists only for a new board count; an in-game mode on an existing count is a `TEAM_VARIANTS` row (`sl` on 5v5, `gd` on 3v3) plus a label file, with no wire, JSON or storage presence
- **Default maps**: the neutral list (`arena1` on every board): pads short payloads and is the Default choice of the type picker
- **Initial type**: a fresh slate (first visit, corrupt slot, a mode with no slot) opens on `initialVariant` (Supreme League for 5v5, Guild Duel for 3v3), else on the default maps. New keeps the type the live boards match and falls back to the initial type when their maps match nothing
- **`matchVariant(mode, maps)`**: ordered exact match of the boards' map keys against the default list, then the mode's types; `'default'`, a variant key, or null for custom maps. A key-less board counts as the default map. `variantMaps` inverts it for the picker and `rebuildOn`
- **Rotation**: a season edits the `sl` row and nothing else; slots and records keep their maps, and boards on the old list simply stop matching (no chip, out of the type filter, reachable under All or by name)
- **`t` is authoritative**: serialized tile states are self-sufficient (restore resets all tiles and replays `t`), so records referencing retired maps still restore, preview, and re-export; map configs are needed only for empty boards and the Maps-tab picker
- **Map key resolution**: `resolveBoardMap` (`/src/lib/maps.ts`) is the one rule for a board with no `m`: the preset its tiles reproduce, else the default map. Canonicalization fills `m` through it and the multi-board restore builds contexts through it, so a record's chip and the boards it loads into always name the same maps
- **`resolveTeamMode(state)`**: a declared `mode` is honored only when its board count matches; otherwise the smallest fitting count decides
- **`normalizeTeamPayload`**: strips retired seasonal content, truncates/pads a payload to the mode's exact shape, and strips the `y` (synergy) section on modes without `allowSynergy`, since a crafted synergy unit would bypass the page-wide duplicate repair. Runs on every teams-page ingress (slot restore, saved-team load, `?g=`); `/share` renders payloads as-is
- **Retiring a mode** goes through a conversion window: a temporary migration converts the retired key and wire id for as long as it lives, and both are freed with its deletion (see [URL Serialization](./URL_SERIALIZATION.md), Wire registries)

## Per-Mode Persistence

`useTeamsPersistence` (`/src/composables/useGridPersistence.ts`) writes an `ActiveSlot` envelope per mode:

```text
stargazer.teams.mode                 last-used TeamModeKey
stargazer.teams.active.<mode>        { v: 1, data: <encoded MultiGridState>, sourceId }
stargazer.teams.display              packed display-flags byte (device prefs)
stargazer.teams.saved                { v: 1, teams: SavedTeam[] }
stargazer.teams.saved.backup         an unknown-version library blob, copied aside on read
```

`sourceId` is the saved team the active boards were loaded from / last saved to (null = unsaved). A slot with an unknown version or a non-string `data` reads as absent (unknown keys are ignored and dropped by the next write), and an undecodable payload falls back to the mode's initial boards. The autosave watcher (one per page instance) routes writes to the live mode's slot; `flush()` is inert until `startAutosave()` marks the instance as the slot's writer, so a degraded page can never overwrite a slot. The retired `5v5sl` slot is moved into the 5v5 slot (when it was the last-used mode) or dropped by the TEMPORARY mode pass in `/src/utils/upgradeMigration.ts`.

`useTeamsRestore` (`/src/composables/useTeamsRestore.ts`) owns every switch, applying payloads through `restoreMultiFromEncodedState` (per-board apply order, companion settling, cross-board dedupe, phantimal baseline re-seeding):

1. Pause autosave, flush the old mode's slot
2. Set + persist the new mode
3. Normalize and restore the new mode's slot (the restore rebuilds the boards) or build the mode's initial boards; exactly one rebuild. Display flags in the payload are ignored
4. Clear board-qualified selection, re-assert page sizing
5. Adopt the slot's `sourceId`, normalized through the library (unresolvable → null)
6. Resume autosave, write the baseline

A `?g=` link is binary and names its own mode (`decodeLinkFromUrl`): the decoded payload re-encodes as interchange JSON and applies through the same path with `sourceId = null`, overwriting its mode's slot (a shared link is nobody's saved team); its mode is persisted only after a successful apply. An arena-mode payload is a wrong-page link; it and any link that fails to decode or apply fall back to the saved slot, which autosave then cannot wipe.

Every strip of retired seasonal content (explicit loads and quiet slot/link restores alike) raises the dismissible season banner above the boards (`useSeasonNotice`, a session-only singleton; see [Seasonal Content](./SEASONAL.md), "Season cutover & retirement").

## Saved-Team Library

`useTeamLibrary` (`/src/stores/teamLibrary.ts`) holds `SavedTeam` records (`/src/lib/teams/savedTeam.ts`), the at-rest shape inside `stargazer.teams.saved` and backup files:

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

- **Validation**: hydration and import run every record through `validateSavedTeam` (known mode, matching board count, canonicalizable data); a failing record drops alone, never the library
- **Map keys unchecked**: `t` is authoritative, so a record referencing a retired map stays valid
- **Seasonal ids unchecked, season-stamped**: a record referencing retired seasonal content stays valid and lossless: the payload's `season` stamp marks it, thumbnails and previews render "S{n}" placeholders instead of resolving the reused ids, and loading strips the retired refs from the live boards while the record keeps them until re-saved
- **Canonical at the owner**: `saveAsNew`/`update` canonicalize their input rather than trusting callers
- **`updatedAt` is content-only**: `update` stamps it, `rename` does not, so the last-modified sort and the card's "updated" label track board edits rather than relabels
- **Serializer contract**: canonicalization rebuilds each board from `BOARD_CONTENT_KEYS` (exported beside `BoardState`, contract-tested), so a new `GridState` section must be registered there to survive in saved teams; a unit-bearing section must also be handled in `preview.ts` and `sideLoad.ts`
- **Concurrency**: mutations re-read the stored blob first (read-modify-write); cross-tab sync is out of scope beyond that. A failed write (quota, storage disabled) leaves the store on its in-memory list until a write lands again, and `persisted` lets the page report the loss instead of claiming a save (`useTeamLibraryFeedback`)
- **Layering**: the store returns typed results and never toasts; components own user feedback
- **Cap**: `MAX_SAVED_TEAMS` (500); `saveAsNew`, `duplicate`, and import return null / count as skipped at the cap

Semantics wired in `TeamsView`:

- **New**: fresh boards on the type the live boards match (else the mode's initial type) with provenance detached, so Save can no longer overwrite the previous source (Clear only empties content and keeps the tie). The type picker's switch is the same rebuild on the chosen list; both go through `rebuildOn`
- **Save**: updates the source team in place (a record another tab deleted reports `app.team-missing`); with no source it degrades to **Save as New**, whose popover names a new record and adopts it as the source. The popover prefills a match import's pending name, else boards on a named type get the season and type ("S7 SL", then "S7 SL - 2" via `uniqueName`), else "Team N"
- **Load**: switches to the team's mode, applies its content (normalized like every ingress), and repoints `sourceId`; display toggles stay untouched. Duplicate loads the copy, so edits made right after land on it
- **Dirty**: the live snapshot's `teamContentKey` vs the source record's; board clicks, display toggles, and a season flip over an unchanged team never trip it. The card matching `sourceId` gets the "Loaded" ring, the same provenance
- **Thumbnail export**: `useThumbnailExport` serializes the card's `BoardThumbnail` SVGs and rasterizes them onto one canvas, because WebKit fails on DOM-snapshot capture of SVG content and the vectors upscale losslessly to full-grid resolution

## Side Loading (Load Menu)

`TeamLoadMenu` (`/src/components/teams/TeamLoadMenu.vue`) stamps a saved one-sided team onto the live boards without touching the other side:

- **Eligibility**: a record qualifies when every unit on every board (heroes, companions, phantimals, synergy units) belongs to one team, and at least one unit exists; the rule spans the whole record, never a single board (`savedTeamSide` in `/src/lib/teams/sideLoad.ts`, memoized per record, retired seasonal refs ignored)
- **Two groups, two scopes**: the active mode's teams load board-for-board; a second group offers 1v1 teams in every other mode, loading onto the active board only. Units page-wide uniqueness already claims (a hero on the destination team of another board) are skipped and counted in the toast. Grouping is by mode, so a record of one type loads board-for-board onto boards of another (a Supreme League team onto Default 5v5 boards); a unit whose saved hex the live map assigns elsewhere takes the random-tile fallback, and the card's type chip is what tells the two apart
- **Plan**: `buildSideLoadPlan` maps the record to per-board `{ mains, companions, phantimal, artifact }`; the synergy hero rides in `mains` only when the destination mode has `allowSynergy`
- **Executor** (`grids.loadTeamSide`): clears the destination side via `clearTeam` (per-hex removal would leave the side's attr records behind), then places each unit on its saved hex, falling back to a random destination tile when the live map assigns that tile elsewhere or something already stands there: a stamp never replaces, so it cannot evict this load's own work. Companions spawn from their main's skill and are settled onto their saved hexes per main, the same anti-squatting pass the bulk restore runs; an unreachable target leaves the companion at its spawn tile. Every placed base hero gets its full attr record stamped (saved values or an empty record, so a stale value cannot attach), phantimals place after mains (their faction gate needs the roster), the side's artifact is carried unless the destination team already holds it on another board, and the phantimal baseline re-seeds so a deliberately phantimal-less save stays that way
- **Invert**: flips the destination team and 180-rotates every saved hex (`rotatedHexId` in `/src/lib/grid.ts`: cube-coordinate negation, `46 - hexId` on the full arena), with the same random fallback
- **Confirm**: a load that would remove anything on the boards it touches (`grids.sideLoadWouldReplace`, the executor's read-only mirror) arms the two-step confirm; an empty destination loads in one click
- **Deliberately not a restore**: a one-sided merge composed from engine primitives, bypassing `restoreMultiFromEncodedState` (which replaces whole boards); `sourceId`, maps, and display flags stay untouched, and the edit surfaces as normal unsaved changes that autosave persists

## Team Import

`TeamImportButton` (`/src/components/teams/TeamImportButton.vue`) opens `TeamImportModal` (loaded on first use), which reads the game's match result screenshots and saves what they show as a new library record. The readers, the review, the plan and the reference images are documented in [IMPORT_TEAM.md](./IMPORT_TEAM.md); this page owns:

- **Apply**: `grids.applyRosters(plan)` clears both sides of each mapped board and stamps the plan's rosters with engine primitives, not a restore, so `sourceId`, maps and display flags stay untouched; `rostersWouldReplace` mirrors it for the two-step confirm and `rosterConflicts` previews what page-wide uniqueness will skip
- **Save as New**: `TeamsView.handleImportMatch` applies the plan, waits a tick for the phantimal reconciler, and saves the boards as a new record under the plan's suggested name, which becomes their title and source; a full library leaves an unsaved team carrying the name (`pendingName`), cleared by New, Load, Save as New or a mode switch
- **Shared pickers**: the review's hero and artifact pickers are the on-grid popups' palettes (`CharacterSelectionPalette`, `ArtifactSelectionPalette`) in a `SelectionPopup` layered over the modal

## Thumbnails

`BoardThumbnail` (`/src/components/grid/BoardThumbnail.vue`) renders any map + unit set as pure data → SVG; `TeamPreview` (`/src/components/teams/TeamPreview.vue`) drives it from a record's decoded data (`/src/lib/teams/preview.ts`), never from live contexts or DOM capture.

- **Tiles from `t`**: each board renders from the record's own tile states, exactly what Load produces; the map-config baseline applies only when a board has no `t`
- **Caches**: hex polygons are memoized at module level per hex size, and baseline tile states per map key, so a full library renders hundreds of boards from one polygon set. Cards use `content-visibility: auto`
- **Units**: hex-clipped portraits with a team-colored ring (a dot for unresolvable units, an "S{n}" label for retired seasonal ones); `clipPath` defs exist only for occupied hexes. Companion ids resolve through `gameData.getCharacterImageNameById`; synergy units (`y`, local ids) resolve exactly like `c` entries
- **Artifacts**: the ally/enemy ids from the record's `a` section on the artifact host cells (`artifactHostHex` in `/src/lib/grid.ts`: left of hex 1, right of hex 45, the same cells `GridArtifacts` anchors on). Those cells fall in the empty corners of the hex grid's bounding box, so showing them costs no framing change; an id that no longer resolves draws nothing
- **Reuse**: `ArenaPreviewGrid` (Maps tab + Map Editor preset picker) renders through the same component with a square viewBox; `TeamPreviewModal` shows the same `TeamPreview` at modal scale (`large`) without loading the team

## Backup Files

`/src/lib/teams/transfer.ts` builds and parses the export envelope `{ app: 'stargazer', kind: 'saved-teams', version: 1, exportedAt, teams }`; a file holds the whole library or, with a filter active, only the filtered view.

- **Merge-only**: a malformed envelope rejects wholesale; records re-validate and canonicalize; "Replace everything" is Delete all + Import
- **Dedupe**: duplicates of existing teams and in-file duplicates are skipped. The key is content key + name, so an old export of an unchanged seasonal-free team still dedupes across a season flip
- **Ids survive**: accepted records keep the file's ids so identity survives a round trip, regenerating only when an id is overlong (> 64) or already taken. A record whose id belongs to an existing team (an old export of it, edited since) imports under an "(imported)"-suffixed fresh id and counts as a conflict in the toast
- **Cap overflow**: counts as skipped

## Related Documentation

- [`/docs/architecture/IMPORT_TEAM.md`](./IMPORT_TEAM.md) - The match screenshot import: readers, review, plan, reference images
- [`/docs/architecture/GRID.md`](./GRID.md) - Multi-board store, grid contexts, placement modes, bottom sheet
- [`/docs/architecture/URL_SERIALIZATION.md`](./URL_SERIALIZATION.md) - The binary link codec, the `MultiGridState` interchange format, canonical form
- [`/docs/architecture/SEASONAL.md`](./SEASONAL.md) - Season stamps, retired content masking and the ingress strip
- [`/docs/architecture/DRAG_AND_DROP.md`](./DRAG_AND_DROP.md) - Cross-board character and artifact drag
