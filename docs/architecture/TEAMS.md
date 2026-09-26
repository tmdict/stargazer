# Teams

The Teams page (`/teams`) edits several boards at once and keeps a library of saved teams. A mode is a board count (1v1, 3v3, 5v5), and each mode keeps its own working team, so switching modes never loses work. Within a mode, a type such as Supreme League or Guild Duel is a named list of maps, one per board.

What makes the page tricky is that the same team data enters from many places (the mode's autosave, a saved team, a share link, a one-sided load, a screenshot import), and all of them must end up as boards that obey the same rules.

## How it fits together

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

Every stored form of a team, whether a mode's autosave, a saved team or a backup file, is the same encoded `MultiGridState` JSON string. Share links carry the same content in the compact binary link format ([URL Serialization](./URL_SERIALIZATION.md)).

## Modes and types

`src/lib/teams/modes.ts` defines both. Board counts are unique across modes, so a mode key, a board count, an autosave slot and a link's mode id all name the same thing. An in-game mode that uses an existing board count is a `TEAM_VARIANTS` row plus a label, not a new mode, and never reaches storage or links.

A team's type is never stored. `matchVariant` compares the boards' maps, in order, against the default list and then the mode's types, and the result is either a type, the default, or nothing for hand-picked maps. Because it is derived, a season that changes the Supreme League map list only edits that one row: saved teams keep their maps and stop reading as Supreme League.

A board's serialized tile states (`t`) are authoritative. Restoring resets every tile and replays `t`, so a team on a map that no longer exists still loads, previews and exports. For a board saved without a map key, `resolveBoardMap` picks the preset its tiles reproduce, or the default map, and both the saved-team chip and the restore use that same rule.

Every Teams page load goes through `normalizeTeamPayload`. It drops seasonal content from other seasons ([Seasonal Content](./SEASONAL.md)), pads or truncates the payload to the mode's board count, and removes synergy units on modes that do not allow them, since a hand-crafted synergy unit would slip past the duplicate check. `/share` shows payloads as they are.

## Storage and restore

| Key                             | Holds                                                                       |
| ------------------------------- | --------------------------------------------------------------------------- |
| `stargazer.teams.mode`          | the last-used mode                                                          |
| `stargazer.teams.active.<mode>` | `{ v: 1, data, sourceId }`: the mode's working team and its saved-team link |
| `stargazer.teams.display`       | the display toggles, as one packed byte                                     |
| `stargazer.teams.saved`         | `{ v: 1, teams: SavedTeam[] }`: the library                                 |
| `stargazer.teams.saved.backup`  | a library blob of unknown version, set aside on read instead of lost        |

`sourceId` is the saved team the boards were loaded from or last saved to, or null. A slot with an unknown version reads as empty, and an undecodable payload falls back to the mode's starting boards.

`useTeamsRestore` owns every mode switch:

1. Pause autosave and flush the old mode's slot.
2. Set and persist the new mode.
3. Restore the new mode's slot, or build its starting boards. Exactly one rebuild happens, and the payload's display flags are ignored.
4. Clear board-specific selection and re-apply page sizing.
5. Adopt the slot's `sourceId` if that saved team still exists.
6. Resume autosave.

Every whole-board apply (mode switch, slot restore, saved-team load, `?g=` link) goes through `restoreMultiFromEncodedState`, which handles board order, companion placement, duplicate repair across boards, and the phantimal baseline. A `?g=` link overwrites its mode's slot with `sourceId` null, because a shared link is nobody's saved team. A link that fails to decode or apply, or an Arena link, falls back to the saved slot.

Autosave only writes after the page has started it, so a page that failed to load game data can never overwrite a slot. The page resets to the Arena's single board in `onScopeDispose`, which runs synchronously on unmount, so a hot reload cannot leave the board count wrong.

Display toggles (skills, perspective, team view, invert, wrap) are device preferences shared by every mode. Share links carry them and a `?g=` restore applies them, since showing the sharer's view is the reason for a link. Slot and saved-team restores ignore them.

## Saved-team library

`src/stores/teamLibrary.ts` holds the records (`src/lib/teams/savedTeam.ts`). The rules a change must keep:

- A record's `data` is canonical: no viewer state and a fixed key order, so equal content is byte-equal. The store canonicalizes on save instead of trusting callers.
- `teamContentKey` decides whether the boards differ from their saved team. It ignores the season stamp on teams with no seasonal content, so a season change does not mark them as edited.
- Canonicalization rebuilds each board from `BOARD_CONTENT_KEYS`. A new `GridState` section must be added there or it is silently dropped from saved teams, and a section with units also needs handling in `preview.ts` and `sideLoad.ts`.
- Loading validates each record on its own (known mode, matching board count, data that canonicalizes). One bad record is dropped, never the library.
- Records on removed maps or with other seasons' content stay valid. Their cards show "S{n}" placeholders, and loading strips the old content from the boards while the record keeps it.
- `updatedAt` changes only on content edits, not renames, so the last-modified sort follows board changes.
- Every change re-reads the stored library first. If a write fails, the store keeps working in memory and reports the loss, instead of claiming the save worked. The store never shows messages; components do.
- The library holds at most `MAX_SAVED_TEAMS`.

Save updates the source team in place, or behaves as Save as New when there is none. New builds fresh boards and detaches the source, so Save cannot overwrite the previous team. Clear only empties the boards and keeps the source.

Search matches heroes per lineup, meaning one board's ally or enemy side, so picked heroes never pair across boards or against the opponent. A filtered export writes only the teams shown and says so in its label and toast, so a partial backup cannot pass for a full one.

## Loading one side

The Load menu stamps a saved one-sided team onto the live boards without touching the other side (`src/lib/teams/sideLoad.ts`, executed by `grids.loadTeamSide`). A team qualifies when every unit on every board belongs to the same side.

It is deliberately not a restore. It clears the destination side (with `clearTeam`, so old upgrade levels cannot come back), then places each unit on its saved hex, or a random free tile when the map puts that hex elsewhere or something already stands there. It never replaces a unit, so it cannot undo its own work. Companions are moved onto their saved hexes right after their main places. Phantimals place after the heroes, because their faction check needs the roster. Maps, display flags and `sourceId` stay as they were, and the change shows up as ordinary unsaved edits.

The active mode's teams load board for board. A second group offers 1v1 teams in every mode, loading onto the active board. Invert loads onto the other side and rotates every hex 180° (`rotatedHexId`).

## Screenshot import

The match-screenshot import ([Team Import](./IMPORT_TEAM.md)) ends here. `grids.applyRosters` clears both sides of each mapped board and places the plan's rosters, again without a restore. The page then waits a tick for the phantimal watcher and saves the boards as a new team under the suggested name. If the library is full, the boards stay unsaved and keep the name.

## Thumbnails

`BoardThumbnail` draws a board as an SVG from a record's decoded data, never from the live boards or a DOM capture, and it renders from the record's own `t` so a thumbnail shows exactly what Load produces. Card export serializes those SVGs onto a canvas, because WebKit fails to capture SVG content from the DOM. Hex shapes are cached per hex size, so a full library draws hundreds of boards from one set of polygons.

## Backup files

`src/lib/teams/transfer.ts` reads and writes `{ app: 'stargazer', kind: 'saved-teams', version: 1, exportedAt, teams }`. Import only merges; replacing everything is Delete all followed by Import. A malformed file is rejected whole, while each record is validated on its own. Duplicates of existing teams are skipped, keyed on content plus name, so an old export of an unchanged team still matches after a season change. Records keep their ids across a round trip. An id that is too long gets a fresh one, and a record whose id belongs to a different existing team (an old export of it, edited since) comes in under a fresh id with an "(imported)" suffix.

## Related documentation

- [Grid](./GRID.md): board contexts and the multi-board store
- [URL Serialization](./URL_SERIALIZATION.md): the link format and the canonical team form
- [Seasonal Content](./SEASONAL.md): season stamps and what loading strips
- [Team Import](./IMPORT_TEAM.md): reading match screenshots
