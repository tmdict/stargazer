# Team Modes & Saved Teams

## Overview

The Teams page is mode-driven: a registry entry selects how many boards are live (1v1, 3v3, 5v5, 5v5 Supreme League) and each mode persists its own active team independently. On top sits the saved-team library — named, canonical snapshots that can be selected, updated, duplicated, deleted, and backed up to a JSON file.

## Design Principles

1. **Mode is data, not a tab**: one registry (`TEAM_MODES`) and one orchestrator reconfigure the single board array; there are never two writers to the live boards
2. **One slot per mode**: each mode autosaves to its own versioned localStorage envelope, so switching modes is lossless by construction
3. **One restore path**: every bulk apply (slot restore, mode switch, saved-team select, `?g=` ingress) goes through `restoreMultiFromEncodedState`, inheriting companion settling, cross-board dedupe, and phantimal baseline re-seeding
4. **Canonical team data**: saved-team payloads are the share-link encoding stripped of viewer state (`active`, `d`) with fixed key order, so equal content is byte-equal — the dirty compare and import dedupe are plain string comparisons
5. **Stores return results, callers give feedback**: the library store never toasts (stores must not call composables); components own user feedback

## Team modes

`/src/lib/teams/modes.ts` is the single source of truth:

```typescript
TEAM_MODES: Record<TeamModeKey, TeamModeConfig>
// key, labelKey (i18n), boardCount, defaultMaps (length === boardCount), canWrap
TEAM_MODE_ORDER // picker order, ascending board count
DEFAULT_TEAM_MODE = '5v5sl'
```

- Default maps only seed **fresh slates** (a mode with no slot) and pad short crafted links. Persisted state — active slots and saved teams — carries its own per-board `m` keys, so changing a mode's default list never touches existing data.
- Modes and arena JSON files are add-only: removing either would orphan persisted records (hydration drops records referencing unknown modes/maps as its safety net).
- `resolveTeamMode(state)` maps a decoded payload to a mode: a declared `mode` is honored only when its board count matches; otherwise the count decides (5 boards → Supreme League, else the smallest fitting mode). `normalizeTeamPayload` truncates/pads a payload to the mode's exact shape (teams-page ingress only; `/share` renders payloads as-is).

## Per-mode persistence

`useTeamsPersistence` (`/src/composables/useGridPersistence.ts`) writes an `ActiveSlot` envelope per mode:

```
stargazer.teams.mode                 last-used TeamModeKey
stargazer.teams.active.<mode>        { v: 1, data: <encoded MultiGridState>, sourceId }
stargazer.teams.saved                { v: 1, teams: SavedTeam[] }
```

`sourceId` is the saved team the active boards were loaded from / last saved to (null = unsaved). Unknown envelope versions and undecodable payloads are treated as absent. The autosave watcher (default pre-flush, one per page instance) routes writes to the live mode's slot; a pause flag gates it during switches as defense-in-depth for any future async step.

`useTeamsRestore` (`/src/composables/useTeamsRestore.ts`) owns every switch:

1. pause autosave, flush the old mode's slot
2. set + persist the new mode
3. restore the new mode's slot (the restore rebuilds the boards) or build the mode's defaults — exactly one rebuild, **always** (equal-count modes still differ in maps/state)
4. clear board-qualified selection, force wrap off for non-wrap modes, re-assert page sizing
5. adopt the slot's `sourceId`, normalized through the library (unresolvable → null)
6. resume autosave, write the baseline

A `?g=` link resolves + normalizes first, then applies through the same path with `sourceId = null`, overwriting the routed mode's slot (a shared link is nobody's saved team). A link that fails to decode falls back to the saved slot, which autosave then cannot wipe.

## Saved-team library

`useTeamLibrary` (`/src/stores/teamLibrary.ts`) holds `SavedTeam` records (`/src/lib/teams/savedTeam.ts`): id, name (≤ 60 chars), mode, canonical `data`, timestamps; capped at `MAX_SAVED_TEAMS` (200, ≈ 6 KB per full team). Hydration and import validate every record through `validateSavedTeam` (known mode, board count matches, map keys exist, data canonicalizes). Mutations re-read the stored blob first (read-modify-write); cross-tab sync is deliberately out of scope beyond that.

Semantics wired in `TeamsView`:

- **Save** updates the source team's data in place; with no source it degrades to **Save as New**, whose popover names a new record and adopts it as the source
- **Select** switches to the team's mode, applies its content (viewer display toggles untouched — canonical data has no `d`), and repoints `sourceId`
- **Dirty** ≡ `canonicalTeamData(live snapshot) !== source.data` — board clicks and display toggles never trip it
- **Delete / Delete all** use the two-step inline confirm; deleting the source reverts the label to "Unsaved team" (other modes' slots self-heal at adoption)

## Thumbnails

`BoardThumbnail` (`/src/components/grid/BoardThumbnail.vue`) renders any map + unit set as pure data → SVG: hex geometry is memoized at module level per hex size, map tile states per map key, portraits are hex-clipped `<image>`s with a team-colored ring (dot fallback for unresolvable units), and `clipPath` defs exist only for occupied hexes. `ArenaPreviewGrid` (Maps tab + Map Editor) renders through it with its historical square framing; `TeamPreview` decodes a record once (`/src/lib/teams/preview.ts`) and renders one thumbnail per board. The Saved Teams roster panel mounts on first activation and its cards use `content-visibility: auto`, so a full library never taxes page load.

## Backup files

`/src/lib/teams/transfer.ts` builds and parses the export envelope (`{ app, kind, version, exportedAt, teams }`). Import is merge-only: a malformed envelope rejects wholesale; records re-validate and canonicalize; duplicates of existing teams (canonical data + name) and in-file duplicates are skipped; accepted records get fresh ids; cap overflow counts as skipped. "Replace everything" is Delete all + Import.
