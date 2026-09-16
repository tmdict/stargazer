# Grid & Characters

## Overview

The grid system provides the spatial foundation for the game, managing hexagonal tiles, character positions, and state transitions. Every board is a `GridContext` (a `Grid` plus its `SkillManager`), the `useGrids` store arbitrates across boards, and `lib/characters/` mutates a grid through atomic transactions that keep tile state and skill state consistent.

## Design Principles

1. **Cube Coordinates**: Every hex is `(q, r, s)` with `q + r + s = 0`, enforced in the `Hex` constructor; the game's tile number is a separate `id`
2. **Functional Character API**: `lib/characters/` is pure functions over a `Grid` and a `SkillManager`; the `Grid` exposes its team and companion state as public fields for them
3. **Transaction Pattern**: Every composite operation runs through `executeTransaction`, with LIFO rollback from the first failing step
4. **Identity by ID Band**: A unit's numeric band says what it is (hero, placeholder, companion, phantimal, synergy copy), so identity travels through moves, swaps, and serialization with no extra state
5. **Boards Are Entities**: Per-board state lives on a `GridContext`; `useGrids` owns only what spans boards (active pointer, display globals, page-wide uniqueness, drop routing)

## Architecture

```
┌──────────────────────┐     ┌──────────────────────────────┐
│      Components      │────▶│    useGrids + adapter stores │
│                      │     │                              │
│ - GridContainer      │     │ - board array, active id     │
│ - GridManager        │     │ - display globals, Syn       │
│ - GridTiles / Chars  │     │ - uniqueness, drop routing   │
└──────────┬───────────┘     └──────────────┬───────────────┘
           │ inject                         │ owns N
           ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│                GridContext (one per board)               │
│  Grid + SkillManager + map + artifacts + attr records    │
│  layout / crop / target maps / place / move / swap       │
└──────────────────────────┬───────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ lib/characters │ │   lib/skills   │ │ lib/pathfinding│
│ place / remove │ │ SkillManager   │ │ closest target │
│ move / swap    │ │ companions     │ │ A* paths       │
└────────────────┘ └────────────────┘ └────────────────┘
```

## Boards

### GridContext (`/src/composables/useGridContext.ts`)

The per-board entity. `createGridContext(id, mapKey, globals)` builds one; `provideGridContext` / `useGridContext` hand it to descendants. It owns the board's `Grid`, `SkillManager`, current map, artifact slots, and upgrade-attr records, the derived layout, crop, closest-target maps, and skill overlays, and the place / remove / move / swap / auto-place / phantimal / clear operations bound to that grid.

- **Detached effect scope**: derived computeds and the phantimal watcher run in their own `effectScope`; `dispose()` stops it so a rebuilt board leaks no watchers
- **Globals come from `useGrids`**: hex size, team view, invert, Syn, and the shared team-view crop are refs passed in, since every board renders at one size with one set of display flags
- **Map switch rebuilds in place**: `switchMap` `Object.assign`s a fresh `Grid` over the reactive proxy (identity preserved), resets and re-attaches the `SkillManager`, and drops every attr record
- **Team view**: always shows the ally side; the crop covers the visible hexes plus the ally artifact host cell, and on a multi-board page every board uses the union crop from `useGrids.sharedCrop` so the row stays even-sized
- **Phantimal reconciliation**: a `placements` watcher removes a phantimal whose team fell below the faction requirement and auto-places one on the transition into qualifying (edge-triggered against `lastQualifyingPhantimal`); bulk restores call `seedPhantimalBaseline` afterwards so a saved state without its phantimal loads without one. See [Seasonal Content](./SEASONAL.md)
- **`handleDrop` is same-board only**: grid-source drags move or swap, roster drops place (an occupied target is a replace resolved by `resolveReplacement`); cross-board routing lives one level up

### useGrids (`/src/stores/grids.ts`)

The aggregate: the board array, `activeId` / `active`, and the rules that span boards. It always holds at least one board (`setGridCount(1)` at creation); `setGridCount(n, maps?)` disposes and rebuilds, clamped to `[1, MAX_GRID_COUNT]` (5) so a crafted link cannot build arbitrary boards.

- **Page-wide uniqueness**: a character is unique per (character, team) across all boards (`findPlacement` / `isUsed`); artifacts likewise per team (`findArtifactPlacement` / `isArtifactUsed`). Placeholders are exempt. `dedupeCharacters` repairs this after a bulk restore, keeping each pair's first placement in board order
- **`resolvePick`**: the engine's `resolvePlacement` / `resolveReplacement` plus page-wide uniqueness; every roster entry point (click, tap, popup, drag gate) goes through it, so hover cues and drops cannot disagree
- **`canDropCharacter`**: the read-only mirror of `routeDrop`'s validation, read by the drag-hover cue in `GridTiles`. The engine's per-grid checks still have the last word at drop time; a per-board rejection resolves as a silent no-op
- **`routeDrop`**: roster and same-board drops use the board's `handleDrop`; cross-board drops compose remove + place as compensating transactions (`crossGridMove`, `crossGridSwap`, restoring the originals on failure). A successful drop makes the target board active. `routeLiftDrop` builds the drag-style payload from a lifted cell so tap-moves pass every drag gate; `routeArtifactDrop` / `canDropArtifact` do the same for artifacts via `resolveArtifactDrop`
- **Live cells are authoritative**: drop payloads carry only source coordinates; ids and teams are read from the cells at drop time
- **Attrs travel with heroes**: cross-board moves, swaps, and `swapBoards` transfer each hero's record with `setAttrs(dest, takeAttrs(source))`; a same-board team change re-keys inside the board's own move / swap
- **`swapBoards`**: exchanges two boards' directly placed mains (with attrs) and artifacts, keeping teams; companions and phantimals re-derive from the roster, and placement is random, so formations are not preserved
- **Syn flag**: `synergy` is never serialized; `deriveSynergy` re-reads it from board content after every restore, and `setSynergy(false)` removes every team's synergy unit on every board so the box always mirrors the boards

### Adapter stores (`/src/stores/grid.ts`, `character.ts`, `skill.ts`, `artifact.ts`, `pathfinding.ts`)

Thin facades forwarding the single-board API to `useGrids().active`. Single-board consumers (the Arena, the roster) read through these and never learn how many boards exist; per-board components inject their own `GridContext`. `GridContainer` provides its context through a forwarding `Proxy`: on the Arena the prop is bound to whichever board is active, and that instance is replaced when boards are rebuilt (page navigation and mode switches run `setGridCount`), so descendants always read the live board rather than a disposed snapshot.

### Multiple boards on the Teams page

A `TEAM_MODES` entry (`/src/lib/teams/modes.ts`) selects the board count and default maps; `useTeamsRestore` orchestrates every rebuild while the page is live, and `TeamsView` resets to one board on leave. Each mode autosaves to its own slot (`stargazer.teams.active.<mode>`, a versioned envelope with saved-team provenance). See [Teams](./TEAMS.md).

### Invert (view rotation)

The engine has one fixed orientation: ally occupies the low hex-id side and targeting assumes ally faces the high-id side (`lib/skills/utils/distance.ts`, `lib/pathfinding.ts`). Engine teams are display teams; nothing relabels them.

`inverted` (`useGrids`) is a pure view transform. Each board's `Layout` is rebuilt with the `rotated` flag: `hexToPixel` negates the offset from the origin (the canvas center the point-symmetric full grid rotates onto itself around), and `hexCornerOffset` negates too so corner index `i` keeps naming the same physical corner. Because tiles, sprites, arrows, skill overlays, artifact host cells, popup anchors, crop bounds, and `GridManager.findHexUnderMouse`'s point-in-polygon test all derive from that one layout, the board flips consistently (walls and tile numbers included) and a click on a rotated board resolves to the engine hex under the cursor by construction.

- **Two surfaces need explicit rotation awareness**: `GridCharacters` paints sprites in ascending rendered-y order (near rows over far), since grid storage order only matches on the canonical view; `GridArtifacts` marks as `front` whichever host cell renders at the screen-bottom edge
- **Thumbnails and snippets stay canonical**: `BoardThumbnail` and `GridSnippet` build their own layouts and never set the flag
- **Serialized as a display flag**: `d` bit 3, meaning "the sharer had the board rotated"; restoring it rotates the view and nothing else. The Arena carries it inside its save slot; Teams stores it with the other device-level view prefs. Each page resets `teamView` and `inverted` at setup so a first visit never inherits another page's toggles
- **Content-level rotation is separate**: `rotatedHexId` (`lib/grid.ts`) negates all three cube coordinates; side-load's invert option uses it to mirror a saved formation onto the other team

## Core Components

### Grid (`/src/lib/grid.ts`)

Pure spatial state: a `Map` of tiles keyed by `"q,r,s"`, a parallel `hexById` index (hexes are immutable, so it never invalidates), and the public fields `lib/characters/` mutates directly: `maxTeamSizes` (base `BASE_TEAM_SIZE` = 5 per team; companion skills raise it while active), `companionLinks` keyed `"${mainId}-${team}"`, and an optional `skillManager` that composite operations refresh after success.

- **Tile**: `{ hex, state, characterId?, team? }`. `clearCharacterFromTile` reverts only `OCCUPIED_*` to `AVAILABLE_*`; blocked and default tiles keep their state
- **Map applies onto a fixed preset**: the constructor builds `FULL_GRID` and then paints the map's tile states over it, so every map shares one hex id space
- **Artifact host cells**: `artifactHostHex` returns the off-grid neighbor left of cell 1 (ally) and right of cell 45 (enemy). They hold no tile, so placement, pathfinding, and targeting never see them; rendering and artifact arrows anchor on them

### Hex and Layout (`/src/lib/hex.ts`, `/src/lib/layout.ts`)

`Hex(q, r, s, id)` throws unless the coordinates sum to zero. Direction indices 0 to 5 run clockwise from top-right, and `neighbor` normalizes negative indices. `Layout(orientation, size, origin, rotated)` converts hexes to pixels (`hexToPixel`, `polygonCorners`) and draws the arrow and line paths; every render and hit-test surface on a board shares that board's one `Layout`.

### Unit ID Namespaces

Every unit on a tile is a `characterId`, and the id's band encodes its kind:

| Band          | Unit                                                                                                | Wire form                       |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1–8999        | base heroes                                                                                         | `c`, raw id                     |
| 9000–9999     | placeholders                                                                                        | `c`, raw id                     |
| 10000–99999   | companions (`N * 10000 + mainId`)                                                                   | `c`, raw id                     |
| 100000–199999 | phantimals                                                                                          | `s`, local id (offset stripped) |
| 200000–299999 | synergy band: the assist hero at `200000 + baseId`, its companions at `200000 + N * 10000 + baseId` | `y`, local id (offset stripped) |

- **The synergy band mirrors the base namespace** shifted by `SYNERGY_ID_OFFSET`, so companion arithmetic works unchanged inside it. `decomposeUnitId` (`synergy.ts`) is the one place the mirror is decomposed; `isCompanionId`, its grid-free twin `isCompanionUnitId`, `getMainCharacterId`, and `toBaseHeroId` (behind the gameData identity getters) all consume it. `getMainCharacterId` subtracts rather than takes a modulo so a synergy companion cascades to the synergy main, never the base hero
- **Band predicates are bounded above** (`isCompanionId`, `isPhantimalId`), so a higher band never aliases into a lower one
- **Synergy hero rules**: exempt from capacity, capped at one per team (`canPlaceCharacterOnTeam` defers to `synergySlotFree`), invisible to every duplicate check by its offset id, and unable to change team or board. `resolvePlacement` (`character.ts`) turns a roster pick into a base or synergy placement while Syn is armed; `resolveReplacement` (`place.ts`) is its occupied-target form, judged against the post-vacate board (a base hero or placeholder gives back a capacity slot, the synergy hero the assist slot, a phantimal nothing)
- **Phantimals**: exempt from capacity and duplicate checks, capped at one per team by `GridContext`'s placement helpers, and gated by the team's faction count (`phantimalCanJoinTeam`)

### Placeholder Units (`/src/lib/characters/placeholder.ts`)

One stand-in per faction, placeable like a hero to reserve a slot. They join `loadCharacters()` in the 9000 band, so occupancy, capacity, targeting, and serialization treat them as ordinary characters; the roster lists them as one block after all heroes in faction-filter order. Deliberate differences, enforced at call sites via `isPlaceholderId` / the `placeholder` flag: copies repeat freely (no uniqueness, no dedupe, no roster remove-toggle), no upgrade attrs, no skill pages. The real `faction` counts toward phantimal qualification; `class` and `damage` are `none`, which no rule matches, so class-based skills ignore them without special cases. Ids are written per faction and append-only, since share links and saved teams carry them.

### Hero Upgrade Attributes (`/src/lib/characters/attributes.ts`)

The registry of every levelled upgrade a hero carries (paragon, EX refinement) and the only place their ids and ranges are defined. Each entry is `{ id, name, max, default }`; `name` doubles as the `app.<name>` locale key. What each level grants lives in `upgradeStats.ts`.

- **Append-only ids**: never reused or renumbered; saved teams and links carry the number. Character id 0 is reserved for future team-scoped rows. The binary codec's 4-bit value field caps `max` at 15
- **Clamped at every trust boundary**: `clampAttr` (unknown id or non-finite value gives 0, otherwise rounded into `[0, max]`) runs in `setAttr`, the binary decoder, and saved-team canonicalization; all three drop rows with an unknown attr id
- **Real heroes only**: `isRealHeroId` gates the panel and dock; the serializer walks base heroes only

Each `GridContext` keeps one `AttrRecord` (`{ [attrId]: value }`, absent key = default) per team + character, keyed that way rather than by hex so values follow a hero across moves and each team tracks a hero independently:

```typescript
getAttr(team, characterId, attrId): number   // default when unset
getAttrs(team, characterId): AttrRecord
setAttr(team, characterId, attrId, value)     // clamped; a default value deletes the key
setAttrs(team, characterId, record)           // replaces the whole record, never merges
takeAttrs(team, characterId): AttrRecord      // read and clear in one step
```

- **Sparse**: an all-default record is deleted, so an untouched board holds and serializes nothing
- **Survives removal**: a removed hero's record lingers (neither rendered nor serialized) until the hero returns; `clearTeam` drops one side's records, and `clearCharacters` / `switchMap` drop them all
- **Transfers move the whole record**: every hand-off is `setAttrs(dest, takeAttrs(source))`; replace semantics let side-load stamp a full record so a stale level cannot linger. A same-hero cross-team swap reuses a key, so both records are taken before either is written

Serialization is the `u` section: sparse rows `[team, characterId, attrId, value]` sorted by `compareAttrRows`, the one comparator shared by the serializer, canonicalization, and the legacy converter so identical content is byte-identical (the unsaved-changes compare and import dedupe are byte compares). See [URL Serialization](./URL_SERIALIZATION.md).

## Character Operations

### Transactions (`/src/lib/characters/transaction.ts`)

`executeTransaction(operations, rollbackOperations)` runs the steps in order and stops at the first that returns `false` or throws. Rollbacks then run in LIFO order so each sees its dependencies still applied, and a throwing rollback does not halt the rest of the chain. Composite operations call `skillManager.updateActiveSkills` only after a successful transaction.

### Placement (`/src/lib/characters/place.ts`)

`executePlaceCharacter` is three steps: clear the occupant (if any) with full skill cleanup, `performPlace`, activate the newcomer's skill. Rollback removes the newcomer, re-places the occupant, re-activates its skill, and returns its companions to their tiles.

Gates, in order:

1. Companion ids are rejected (companions exist only through skills)
2. The tile's zone matches the team (`canPlaceCharacterOnTile`: the available or occupied state of that team)
3. `canPlaceCharacterOnTeam`: capacity, then no duplicate on the team (placeholders skip the duplicate check; phantimals skip both; the synergy hero replaces both with `synergySlotFree`)
4. `performPlace` never displaces an occupant: replacement is the composite above, and swaps clear both tiles first
5. Skill activation, if the character has one

A companion occupant cascades to its main (removing either removes the whole unit), so the anchor is the main's hex. `executeAutoPlaceCharacter` picks a random available tile and has no replace step.

### Removal (`/src/lib/characters/remove.ts`)

`executeRemoveCharacter` runs without a transaction because removal always succeeds: deactivate the skill (which removes any companions it spawned), then clear the tile. Removing a companion removes its main instead, so the whole unit goes together; a companion whose main is missing is cleared directly. Team membership and capacity derive from tiles, so nothing else needs updating.

### Move and Swap (`/src/lib/characters/move.ts`, `swap.ts`)

- **Team is the destination zone's**: a move's target team comes from the tile state, so a same-board move can change teams
- **Skill-aware only across teams**: a same-team move or swap is remove + place; a cross-team one is deactivate, perform, reactivate on the new team, with companions restored to their saved tiles on rollback (reactivation respawns them randomly)
- **Who may cross teams**: companions and synergy heroes cannot move across teams; phantimals, companions, and synergy heroes can only swap within their own team
- **Cross-team swap pre-check**: rejected if either character already exists on its destination team (one hero may legally appear once per team; placeholders are exempt)
- **Swap rollback clears first**: both tiles are emptied before the originals are re-placed, since `performPlace` never overwrites an occupant

### Team Capacity and Companions (`/src/lib/characters/character.ts`, `companion.ts`)

- **Capacity**: `getAvailableTeamSize` counts every unit on the team except phantimals and the synergy hero; companions count like any other, balanced by their skill's capacity bump. `setMaxTeamSize` is bounded by the tile count
- **`teamHasOpenSlot`**: a capacity slot, or the assist slot while Syn is on; gates the add-only pickers
- **Companion links**: `grid.companionLinks` maps `"${mainId}-${team}"` to the companion ids a skill spawned; `storeCompanionPositions` / `restoreCompanions` carry their tiles through a deactivate-reactivate cycle
- **`repositionCompanions`**: lifts every target off before placing any, so two companions can trade hexes; it uses the raw primitives to sidestep the owner-removal cascade

See [Skills](./SKILLS.md) for the skill side of companions.

## Placement Interaction

### Desktop and mobile

`GridManager` picks the mode from the board's render scale (`ctx.hexScale < 1`: the mobile and tablet breakpoints, up to 768px); a page can override it via `GridContainer`'s `tap-mode` prop, which the Teams page sets from its own breakpoint because its boards render below full scale even on desktop. Every hex-click semantic lives in `GridManager`'s `hex:click` handler; the hero-tap gestures live in `GridCharacters`.

- **Desktop**: drag a roster icon onto a tile (HTML5 drag, mouse-only), or click an empty tile to open `CharacterSelectionPopup`, a multi-add palette: the first pick fills the clicked tile, later picks auto-place on the same team, and it closes on pointer leave, outside tap, Esc, or `!teamHasOpenSlot`. Placed-hero gestures split per pointer (`isTouchClick`, `/src/utils/pointer.ts`): a mouse click removes the hero (moves use drag), while a touch or pen tap enters the lift flow below
- **Mobile add**: the roster lives in the pull-up `BottomSheet`. Tapping an empty tile sets a board-qualified target (`useSelectionState.targetHexId` + `targetGridId`, since every board shares the same hex ids); a full team still targets because a phantimal may fit. A roster tap then places on the targeted cell; with no target it auto-places on the active board, ally side first, then enemy (`fillOrder`). Artifact cells target the same way (`targetArtifactTeam` + `targetArtifactGridId`). Dismissing the sheet clears pending targets
- **Mobile move / remove (tap-lift, tap-drop)**: tapping a placed hero lifts it (`liftedHexId`, board- and unit-qualified). Tapping an empty cell on any board drops it through `routeLiftDrop`, so a tap-move passes every drag gate; tapping the lifted hero again removes it; tapping another hero on the same board swaps (after `canDropCharacter`, so a team change that would duplicate a hero page-wide silently no-ops); tapping a hero on another board starts a fresh lift there. A non-placement tile or a drag start cancels the lift
- **`useLiftGuard`** (installed once in `App.vue`) drops the lift whenever its cell stops holding the lifted unit, so programmatic changes (roster removes, map switches, board swaps, phantimal reconciliation, companion cascades) never leave a stale lift behind

### Syn (friend-assist) affordance

The `Syn` toggle (`GridControls`, shown via `showSynToggle`: the Arena hides it on the Map Editor and Debug tabs, Teams offers it on `allowSynergy` modes) arms `useGrids.synergy`. Every placement entry point then resolves through `resolvePick`, so the surfaces agree by construction:

- **Roster (`CharacterSelection`)**: a placed hero's icon is normally the remove-toggle; while Syn is on and that hero's team still has a free assist slot (`synergySlotFree`), the click places the synergy copy via `placeOnActive` instead. The search overlay's "already placed" toast follows the same rule
- **On-grid popup**: an already-placed hero stays listed as its synergy copy (`resolvePick !== null`), and the popup closes on `!teamHasOpenSlot`, the predicate `GridManager` uses to open it
- **Unchecking**: `setSynergy(false)` removes both teams' synergy units on every board, so `GridControls` also clears any pending target and lift that referenced them
- **Display**: `GridCharacters` and `DebugPanel` resolve a synergy unit through `decomposeUnitId` / `toBaseHeroId`, so the copy keeps its hero's card, sprite, and drag payload (with the placed synergy id)

## Related Documentation

- [`/docs/architecture/SKILLS.md`](./SKILLS.md) - Skill activation, companions, visual modifiers
- [`/docs/architecture/DRAG_AND_DROP.md`](./DRAG_AND_DROP.md) - Drag layers and drop registration
- [`/docs/architecture/TEAMS.md`](./TEAMS.md) - Team modes, per-mode persistence, saved teams
- [`/docs/architecture/SEASONAL.md`](./SEASONAL.md) - Phantimals and seasonal artifacts
- [`/docs/architecture/URL_SERIALIZATION.md`](./URL_SERIALIZATION.md) - Section layouts and display flags
