# Grid & Characters

The grid engine holds the hex boards, the units on them, and the rules for placing, moving, swapping and removing units. Every board is a `GridContext` (a `Grid` plus its own `SkillManager`). The `useGrids` store owns the boards and the rules that span them, and `src/lib/characters/` changes a grid through transactions that keep tile state and skill state in step.

Two things make it hard. Many kinds of unit share one tile slot (heroes, placeholders, companions, phantimals, friend-assist copies), each with slightly different rules. And a page can show up to five boards, so uniqueness, drops and upgrade levels have to hold across boards as well as within one.

## How it fits together

```
┌──────────────────────────┐              ┌──────────────────────────┐
│ Pages, roster, pickers   │              │ Grid components          │
│ (Arena, Teams, Share)    │              │ (one set per board)      │
└────────────┬─────────────┘              └───────┬─────────────┬────┘
             │                                    │             │
             │ picks, restores                    │ drops       │ inject
             ▼                                    ▼             │
┌────────────────────────────────────────────────────────┐      │
│ useGrids                                               │      │
│ boards, active board, display flags, Syn,              │      │
│ page-wide uniqueness, cross-board transfers            │      │
└───────────────────────────┬────────────────────────────┘      │
                            │ owns 1 to 5                       │
                            ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ GridContext (one per board)                                          │
│ Grid, SkillManager, map, artifacts, upgrade attrs,                   │
│ layout, crop, closest-target maps, place, move, swap                 │
└──────────┬────────────────────────┬────────────────────────┬─────────┘
           ▼                        ▼                        ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ lib/characters     │   │ lib/skills         │   │ lib/pathfinding    │
│ placement rules,   │   │ SkillManager,      │   │ closest-target     │
│ transactions       │   │ companion skills   │   │ search             │
└────────────────────┘   └────────────────────┘   └────────────────────┘
```

Every hex is a cube coordinate `(q, r, s)` with `q + r + s = 0`, which the `Hex` constructor enforces. The game's tile number is a separate id. Every map paints its tile states over the same fixed preset (`FULL_GRID`), so all maps share one hex id space.

## Boards

`createGridContext` (`src/composables/useGridContext.ts`) builds a board. Its computeds and phantimal watcher run in a detached effect scope, and `dispose()` stops it so a rebuilt board leaks no watchers. Hex size, team view, invert, Syn and the team-view crop come from `useGrids`, because every board renders at one size with one set of display flags. `switchMap` assigns a fresh `Grid` over the reactive proxy so its identity survives, then resets and re-attaches the `SkillManager` and drops every upgrade record.

Placement operations refresh skill results themselves. Raw tile edits and companion settling do not, so their callers refresh once at the end.

`useGrids` (`src/stores/grids.ts`) always holds at least one board. `setGridCount` disposes and rebuilds the boards, clamped to `MAX_GRID_COUNT` (5) so a crafted link cannot build arbitrary boards. Single-board code such as the Arena reads the active board through thin adapter stores (`grid.ts`, `character.ts` and the others) and never learns how many boards exist. `GridContainer` provides its context through a forwarding `Proxy`, because on the Arena the active board is replaced whenever boards are rebuilt, and descendants must read the live board instead of a disposed one.

The Teams page decides how many boards exist and restores them ([Teams](./TEAMS.md)).

## Rules across boards

A hero is unique per team across all boards, and so is an artifact. Placeholders, companions and phantimals are exempt. A bulk restore validates one board at a time, so `dedupeCharacters` repairs uniqueness afterwards by keeping each hero's first placement in board order.

Every roster pick (click, tap, popup, drag gate) goes through `resolvePick`, which combines the engine's resolver with page-wide uniqueness, so hover cues and drops cannot disagree. A drop that stays on one board runs the board's own `handleDrop`. A drop across boards is a remove on one board plus a place on the other, and restores the original if the place fails. Drop payloads carry only source coordinates, and ids and teams are read from the live cells at drop time. Drag gestures and drop routing are covered in [Drag & Drop](./DRAG_AND_DROP.md).

Upgrade records follow their hero. Cross-board moves, swaps and `swapBoards` transfer the whole record with `setAttrs(dest, takeAttrs(source))`, and a same-board team change re-keys it inside the board's own move or swap. `swapBoards` exchanges only the directly placed heroes and the artifacts. Companions and phantimals are derived from the roster, so they are re-derived on the destination, and units land on random tiles, so formations are not kept.

The Syn toggle (friend assist) is never serialized. `deriveSynergy` re-reads it from the boards after every restore, and turning it off removes every synergy unit from every board, so the box always matches the boards.

## Unit ids

Every unit on a tile is one `characterId`, and the id range it falls in says what kind of unit it is:

| Ids           | Unit                                                                     | Link section    |
| ------------- | ------------------------------------------------------------------------ | --------------- |
| 1–8999        | heroes                                                                   | `c`, raw id     |
| 9000–9999     | placeholders, one per faction                                            | `c`, raw id     |
| 10000–99999   | hero companions, `N × 10000 + hero`                                      | `c`, raw id     |
| 100000–199999 | phantimal `100000 + L`, its companions `100000 + N × 10000 + L`          | `s`, band-local |
| 200000–299999 | synergy hero `200000 + hero`, its companions `200000 + N × 10000 + hero` | `y`, band-local |

The phantimal and synergy ranges repeat the hero layout above an offset, so companion arithmetic works unchanged in all three. Two helpers strip the offset, for different readers. `companionLocalId` (`src/lib/characters/phantimal.ts`) strips the phantimal or synergy offset, and the companion predicates `isCompanionId` and `isCompanionUnitId` classify its result. `decomposeUnitId` (`synergy.ts`) strips only the synergy offset, and the skill registry and `toBaseHeroId` use it. The registry must not strip the phantimal offset, or phantimal 5 would run hero 5's skill.

`inPhantimalBand` covers a phantimal and its companions, while `isPhantimalId` matches only the phantimal. Every id-range predicate is bounded above, so a higher range never reads as a lower one. `getMainCharacterId` subtracts the companion index instead of taking a modulo, so a synergy or phantimal companion resolves to its own owner and never to a base hero. Phantimal details are in [Seasonal Content](./SEASONAL.md).

Placeholder ids are written per faction and append-only, since links and saved teams carry them. A placeholder's real faction counts toward phantimal qualification. Its class and damage type are `none`, which no rule matches, so class-based skills ignore it without special cases.

## Placement rules

| Unit         | Team slot                    | Duplicates    | Moves to other team       | Swaps across teams |
| ------------ | ---------------------------- | ------------- | ------------------------- | ------------------ |
| Hero         | yes                          | once per team | yes                       | unless duplicate   |
| Placeholder  | yes                          | allowed       | yes                       | yes                |
| Companion    | yes, offset by skill bump    | n/a           | no                        | no                 |
| Phantimal    | no, one per team             | n/a           | if the new team qualifies | no                 |
| Synergy hero | no, one assist slot per team | not checked   | no                        | no                 |

Phantimal companions hold no slot either. The one-per-team and faction checks for phantimals live on `GridContext` (`placePhantimal`, `handleDrop`), since the engine has no game data.

`executePlaceCharacter` (`place.ts`) runs its checks in this order:

1. Reject companion ids, since companions exist only through their owner's skill.
2. Clear the occupant, if any, with its skill deactivated. A companion occupant is anchored on its main, so the whole unit leaves.
3. `performPlace`: the tile must be an available or occupied tile of that team, `canPlaceCharacterOnTeam` must pass, and the tile must be empty.
4. Activate the newcomer's skill.

`performPlace` never displaces an occupant. Replacing is the composite above, and swaps clear both tiles first. `resolveReplacement` judges a roster drop on an occupied tile against the board after the occupant leaves: a hero or placeholder gives back a slot, the synergy hero gives back the assist slot, and a phantimal gives back nothing.

Removal always succeeds, so `executeRemoveCharacter` uses no transaction. Removing a companion removes its main instead, and the main's skill then removes the companions. Team membership and capacity are read from tiles, so nothing else needs updating. Companion spawning, rollback and the capacity bump are covered in [Companion Skills](./skills/COMPANION.md).

## Moves, swaps and transactions

A move takes its team from the destination tile, so a same-board move can change teams. A same-team move or swap is a plain remove and place. A cross-team one deactivates the skill, moves, and reactivates on the new team. A cross-team swap is rejected if either hero already stands on its destination team (placeholders excepted).

`executeTransaction` (`transaction.ts`) runs steps in order and stops at the first that returns `false` or throws. Rollbacks then run in reverse order, so each sees the steps it depends on still applied, and a throwing rollback does not stop the rest. Rollbacks put companions back on their saved tiles, because reactivating a skill respawns them at random. A swap rollback empties both tiles before re-placing, since `performPlace` refuses an occupied tile. Composite operations refresh skills only after the whole transaction succeeds.

## Invert

The engine has one orientation. Ally holds the low hex ids and faces the high ids, and targeting and pathfinding assume it. Invert is only a view: each board's `Layout` is rebuilt with its `rotated` flag, which negates pixel offsets from the board center. Tiles, sprites, arrows, overlays, crops and hit-testing all derive from that one layout, so a click on a rotated board resolves to the engine hex under the cursor.

Two surfaces still need to know about rotation. `GridCharacters` paints sprites by rendered y, since grid storage order matches only the unrotated view, and `GridArtifacts` works out which artifact cell sits at the screen bottom. `BoardThumbnail` and `GridSnippet` build their own layouts and always draw unrotated. The flag travels in links as a display flag ([URL Serialization](./URL_SERIALIZATION.md)).

Rotating content is separate. `rotatedHexId` (`src/lib/grid.ts`) negates all three coordinates, and side-load uses it to mirror a saved formation onto the other team.

## Hero upgrade attributes

`src/lib/characters/attributes.ts` defines every levelled upgrade a hero carries (paragon, EX refinement). Attribute ids are append-only because saved teams and links carry them. The link codec's 4-bit value field caps `max` at 15, and character id 0 is reserved for future team-wide rows.

Each board keeps one record per team and hero, keyed that way instead of by hex, so levels follow a hero across moves and each team tracks its copy separately. Records are sparse: a default value deletes its key, so an untouched board stores nothing. A removed hero's record stays, unrendered and unserialized, until the hero returns. `clearTeam` drops one side's records, and clearing all characters or switching maps drops them all. Transfers replace the whole record and never merge, so side-load can stamp a full record without a stale level surviving. A same-hero cross-team swap reuses a key, so both records are taken before either is written.

`clampAttr` runs wherever values enter: `setAttr`, the link decoder and saved-team canonicalization. All three drop unknown attribute ids. Rows are sorted by `compareAttrRows` everywhere they are emitted, because unsaved-change checks and import dedupe compare bytes. The upgrade controls appear only for real heroes (`isRealHeroId`), and the serializer writes rows only for base heroes.

## Map editor

The Arena's Maps tab paints tile states straight onto the live board while its Edit Tiles toggle is on, and turning it on also turns team view off, because team view crops the board to the ally side. Only empty, ally, enemy, blocked and breakable states are paintable. Occupied states come only from placing units. A click in editor mode goes to `useMapEditorStore().setHexState` before any placement logic, so it never opens the unit picker.

`setHexState` removes the occupant of an occupied tile first, since the tile's team may change under it. It then refreshes the board's skills, because terrain-aware skill paint (zones, blocked tiles) is not recomputed by a tile edit. Fill and Clear remove every unit before repainting.

Drag painting in `GridTiles` paints each hex once per drag and at most once every `PAINT_THROTTLE_MS` (50 ms). A hex crossed inside that window is skipped instead of queued, so the user has to re-enter it.

Links and saved boards store every non-default tile, so an edited map round-trips exactly. A payload without a map key is matched to a preset by its tiles (`findMapByTiles`). An edited map matches none and keeps the board's current map key, which is what Clear returns to.

## Related documentation

- [Companion Skills](./skills/COMPANION.md): companion spawn, rollback and removal
- [Skills](./SKILLS.md): the skill registry and runtime
- [Drag & Drop](./DRAG_AND_DROP.md): gestures, taps and drop routing
- [Teams](./TEAMS.md): modes, persistence and saved teams
- [Seasonal Content](./SEASONAL.md): phantimals and their id range
- [URL Serialization](./URL_SERIALIZATION.md): link sections and display flags
