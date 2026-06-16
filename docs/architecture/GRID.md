# Grid & Characters

## Overview

The grid system provides the spatial foundation for the game, managing hexagonal tiles, character positions, and state transitions. It integrates character management with automatic skill activation and implements atomic transactions to ensure data consistency across complex operations.

## Design Principles

1. **Hexagonal Coordinate System**: Axial coordinates (q, r, s) for efficient neighbor calculations
2. **Functional Character API**: Pure functions coordinate grid, skills, and UI
3. **Transaction Pattern**: Complex operations are atomic with rollback capability
4. **Team Isolation**: Separate tracking for ally and enemy placements
5. **Performance Focus**: O(1) lookups using Map-based storage

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   Components    │────▶│  Store Layer     │
│                 │     │                  │
│ - GridTiles     │     │ - Grid Store     │
│ - GridManager   │     │ - Character Store│
│ - DragDrop      │     │ - Reactive state │
└─────────────────┘     └────────┬─────────┘
                                 │
┌────────────────────────────────▼───────────────────────┐
│                          Characters                    │
│                                                        │
│  • Character Queries      • Placement Operations       │
│  • Team Management        • Removal Operations         │
│  • Companion System       • Movement Operations        │
│  • Tile Helpers           • Swap Operations            │
│  • Transactions           • Skill Integration          │
└─────────────────────────┬──────────────────────────────┘
                          │
         ┌────────────────┼───────────────────┐
         │                │                   │
┌────────▼──────┐ ┌───────▼───────────┐ ┌─────▼──────────┐
│     Grid      │ │      Skills       │ │  Pathfinding   │
│               │ │                   │ │                │
│ Spatial State │ │ Skill Registry    │ │ A* Search      │
│ Hex Tiles     │ │ Lifecycle Mgmt    │ │ BFS Search     │
│ Team Tracking │ │ Visual Modifiers  │ │ Distance Calc  │
│ Public Props  │ │ Activation System │ │ Target Finding │
│               │ │                   │ │                │
└───────────────┘ └───────────────────┘ └────────────────┘
```

## Multigrid: one or many boards

One set of stores drives N independent boards. The Arena is the N=1 case; the Teams page's "5 v 5" view is N=5.

- **`GridContext` (`/src/composables/useGridContext.ts`)** — the per-board entity. Each board owns its `Grid`, `SkillManager`, current map, artifacts, derived layout/visibility/skill targets, and its place/move/swap/auto-place/clear operations. `createGridContext(id, mapKey, globals)` builds one; `provideGridContext` / `useGridContext` hand it to descendants.
- **`useGrids` store (`/src/stores/grids.ts`)** — the aggregate. It owns the board array, the active-board pointer (`activeId` / `active`), the globals every board shares (hex size, team view), and the cross-board rules: page-wide character uniqueness (`findPlacement` / `isUsed`), `placeOnActive`, `removeFromAnyBoard`, and `routeDrop` (roster and same-board drops use the board's own handler; cross-board drops compose remove + place as compensating transactions and make the target board active). `setGridCount(n, maps?)` (re)builds the boards.
- **Adapter stores (`grid.ts`, `character.ts`, `skill.ts`, `artifact.ts`)** — thin facades that forward the single-board API to `useGrids().active`. Single-board consumers (the Arena, the roster) read the active board through these and never learn how many boards exist; per-board components inject their own `GridContext` instead.

A multi-board page renders one `GridContainer` per `GridContext` (each provides its own context); `useGrids` arbitrates across them. The Arena's `GridContainer` is bound to whichever board is _active_, and that instance is replaced when boards are rebuilt (navigating Arena ↔ 5 v 5 runs `setGridCount`), so the container provides the context through a small forwarding proxy — descendants always read the live board, never a disposed snapshot.

### Invert (ally/enemy orientation)

The engine has a fixed orientation: ally occupies the low hex-id side and targeting/pathfinding bake in "ally faces the high-id (enemy) side" (see `lib/skills/utils`, `pathfinding.ts`). The two teams' rules are exact mirror images, so the engine's _enemy_ behavior is already correct for a unit on the high-id side.

`Invert` (`useGrids().inverted`, a session-only global like `teamView`) exploits that: it leaves the engine fully canonical and flips only the **display↔engine team mapping**. `invertTeam(team, inverted)` (in `utils/tileStateFormatting.ts`) is the single involution every display surface goes through: tile colors (`GridTiles`), team-view filtering (`GridContext.visibleHexes`, `GridCharacters.visiblePlacements`, `GridArtifacts`), arrow colors (`GridArrows`), the team toggle (`TeamToggle`), and the Map Editor paint labels/preview. Placement, counts, serialization, and all combat math stay in engine space, so a relabeled unit targets correctly for free. Nothing moves on the board; invert relabels what is already there. Debug panels intentionally show canonical engine teams.

## Core Components

### Grid Class (`/src/lib/grid.ts`)

Pure spatial grid and state management:

```typescript
class Grid {
  private storage: Map<string, GridTile>

  // Public for direct access by characters/
  teamCharacters: Map<Team, Set<number>>
  maxTeamSizes: Map<Team, number>
  companionIdOffset = 10000
  companionLinks: Map<string, Set<number>>

  // Spatial operations only
  getTile(hex: Hex): GridTile
  setState(hex: Hex, state: State): void
}
```

### Characters (`/src/lib/characters/`)

Modular operations with direct Grid state access:

```typescript
// character.ts - Queries and team management
getCharacter(grid: Grid, hexId: number): number | undefined
getMaxTeamSize(grid: Grid, team: Team): number
getTeamFromTileState(state: State): Team | null

// place.ts, remove.ts, move.ts, swap.ts - Complex operations
executePlaceCharacter(grid, skillManager, hexId, characterId, team)
executeRemoveCharacter(grid, skillManager, hexId)
executeMoveCharacter(grid, skillManager, fromHexId, toHexId, characterId)
executeSwapCharacters(grid, skillManager, fromHexId, toHexId)
```

Key features:

- **Direct state manipulation** via Grid's public properties
- **Skill integration** in all complex operations
- **Atomic transactions** with automatic rollback
- **Companion support** via companion.ts helpers

### Tile System

```typescript
interface GridTile {
  hex: Hex // Coordinate object
  state: State // Visual/gameplay state
  characterId?: number // Occupying character
  team?: Team // Character's team
}
```

Tile states:

- `DEFAULT` - Normal unoccupied tile
- `BLOCKED` - Impassable terrain
- `AVAILABLE_ALLY` / `AVAILABLE_ENEMY` - Valid placement zones
- `OCCUPIED_ALLY` / `OCCUPIED_ENEMY` - Has character

## Character Operations

### Placement (`/src/lib/characters/place.ts`)

Character placement with skill integration:

```typescript
function executePlaceCharacter(grid, skillManager, hexId, characterId, team) {
  return executeTransaction([
    // Replacement (occupied target only): store companion positions,
    // deactivate the occupant's skill, then remove it
    () => {
      storeCompanionPositions(grid, anchorId, occupantTeam)
      skillManager.deactivateCharacterSkill(anchorId, anchorHex, occupantTeam, grid)
      return performRemove(grid, anchorHex)
    },
    () => performPlace(grid, hexId, characterId, team),
    () => {
      if (!hasSkill(characterId)) return true
      return skillManager.activateCharacterSkill(characterId, hexId, team, grid)
    },
  ])
}
```

Validates:

1. Tile accepts the team
2. No duplicate characters on team
3. Team hasn't exceeded capacity
4. Skill activates successfully (if present)

Placing onto an occupied tile replaces the occupant: its skill is deactivated and it is removed first (a companion occupant cascades to its main character), and the rollback fully restores it — re-place, re-activate skill, restore companions. The atomic `performPlace` primitive itself rejects occupied tiles.

### Movement & Swapping

- **Move (`move.ts`)**: Handles same-team and cross-team movements
- **Swap (`swap.ts`)**: Atomic character exchange with skill transitions; phantimals and companions can only be swapped within their own team. A cross-team swap is rejected up front if either character already exists on its destination team (the same character may legally appear once per team). On failure, rollback clears both tiles before restoring the original placements, since `performPlace` never overwrites an occupant
- **Cross-team logic**: Deactivate → perform operation → reactivate skills

### Removal (`/src/lib/characters/remove.ts`)

Cascading removal for linked characters:

1. Check if character is a companion
2. If companion, find and remove main character
3. Deactivate skills before removal
4. Remove all linked companions
5. Clean up team tracking

### Placement interaction (desktop vs mobile)

The UI for getting a character onto a tile differs by viewport. `GridManager` derives the mode from the board's render scale (`ctx.hexScale < 1` = mobile/tablet, ≤768px); a page can override it via `GridContainer`'s `tap-mode` prop (the 5 v 5 boards force the on-grid popup on desktop and the tap flow on mobile). The two modes:

- **Desktop** — drag a roster icon onto a tile (HTML5 drag, mouse-only), or tap an empty tile to open `CharacterSelectionPopup` (a small picker anchored near the tile) and pick.
- **Mobile/tablet** — HTML5 drag doesn't fire on touch, so interactions are tap-based, split across two gestures:
  - **Add** — the roster lives in a **pull-up bottom sheet** (the shared `BottomSheet` component: `HomeView`'s tab panel on the Arena, `TeamsRoster` on 5 v 5). Tapping an empty tile (with team capacity) sets a board-qualified **target** (`useSelectionState.targetHexId` + `targetGridId`, so only the tapped board highlights it — every board shares the same hex ids), highlights it (`GridTiles`), and opens the sheet; tapping a roster character `placeCharacterOnHex`'s it there (team derived from the tile) and the sheet collapses. With no target set, a roster tap auto-places onto the active board.
  - **Move / remove (tap-lift, tap-drop)** — tapping a placed hero on the grid **lifts** it (`useSelectionState.liftedHexId`; the tile's existing hover/active border marks it, and the sheet collapses so all cells stay reachable). Then: tapping an empty cell `moveCharacter`'s it there (allowed even at full capacity — a move adds no unit); tapping the lifted hero again `removes` it; tapping a _different_ placed hero `swapCharacters` the two. Tapping a non-placement tile cancels the lift. The lift gesture lives in `GridCharacters` (the character overlay's tap); the drop/target/cancel logic lives in `GridManager`'s `hex:click`.

  When the sheet is expanded a tap-scrim sits behind it — tapping it collapses the sheet and clears any pending target.

The Arena, Skills, Guide, and Teams pages share one `BottomSheet` component (`src/components/ui/BottomSheet.vue`) for the roster column — desktop card chrome + the mobile pull-up sheet (drag handle, scrim, `useBottomSheet` drag) — so they stay identical by construction rather than by mirrored CSS. Each page slots its own content (tabs / roster), which owns its in-sheet fill + scroll. The Teams roster passes `:desktop-rail="false"` so it flows as a full-width card below the boards instead of a height-capped side column.

## Team & Companion Systems

### Team Management (`/src/lib/characters/character.ts`)

Direct access to Grid's public properties:

```typescript
// Grid exposes these publicly
grid.teamCharacters: Map<Team, Set<number>>
grid.maxTeamSizes: Map<Team, number>

// character.ts provides functional API
getMaxTeamSize(grid: Grid, team: Team): number
getTeamCharacters(grid: Grid, team: Team): Set<number>
canPlaceCharacterOnTeam(grid: Grid, characterId: number, team: Team): boolean
```

Features:

- **Team Types**: `ALLY` and `ENEMY`
- **Capacity**: Default 5, expandable by skills
- **Duplicate Prevention**: Same character cannot exist twice on one team

### Companion System (`/src/lib/characters/companion.ts`)

Helpers for skill-created linked characters:

```typescript
// Grid exposes these publicly
grid.companionIdOffset = 10000
grid.companionLinks: Map<string, Set<number>>

// companion.ts provides functional API
isCompanionId(grid: Grid, characterId: number): boolean
getCompanions(grid: Grid, mainCharacterId: number, team: Team): Set<number>
addCompanionLink(grid: Grid, mainId: number, companionId: number, team: Team): void
```

See [`/docs/architecture/SKILLS.md`](./SKILLS.md) for skill integration details.

## Transaction System (`/src/lib/characters/transaction.ts`)

Atomic operations with automatic rollback:

```typescript
executeTransaction(
  operations: (() => boolean)[],
  rollbackOperations: (() => void)[]
): boolean
```

Example swap operation:

1. Remove both characters
2. Place in swapped positions
3. If any step fails, rollback all

Rollbacks run in LIFO order so each rollback sees its dependencies still applied, and a throwing rollback doesn't halt the rest of the chain.

## Hexagonal Coordinates

Uses axial coordinates with constraint q + r + s = 0:

```typescript
class Hex {
  constructor(q: number, r: number, s: number, id: number)

  neighbor(direction: number): Hex
  distance(other: Hex): number
  getId(): number
}
```

The Layout class handles pixel conversions:

- `hexToPixel(hex)` - Screen position
- `polygonCorners(hex)` - Vertices for rendering

## Component Usage

### GridSnippet Component (`/src/components/grid/GridSnippet.vue`)

A lightweight grid visualization component used for static content pages (skill documentation):

```typescript
interface Props {
  gridStyle: GridStyleConfig
  width?: number
  height?: number
  hexSize?: number
  images?: Record<string, string> // Optional for SSG compatibility
}
```

Key features:

- **Dual-mode image loading**: Accepts images via props (for SSG) or reads from store (for SPA)
- **Non-interactive**: Display-only, no drag & drop functionality
- **SSG-friendly**: Avoids hydration mismatches by using props for static content
- **Flexible styling**: Supports highlights, numeric labels, and character placement
