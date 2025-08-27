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
  setState(hex: Hex, state: State): boolean
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
    () => performPlace(grid, hexId, characterId, team, true),
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

### Movement & Swapping

- **Move (`move.ts`)**: Handles same-team and cross-team movements
- **Swap (`swap.ts`)**: Atomic character exchange with skill transitions
- **Cross-team logic**: Deactivate → perform operation → reactivate skills

### Removal (`/src/lib/characters/remove.ts`)

Cascading removal for linked characters:

1. Check if character is a companion
2. If companion, find and remove main character
3. Deactivate skills before removal
4. Remove all linked companions
5. Clean up team tracking

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

### Performance Optimizations

The transaction system includes intelligent cache management:

- **Batched Cache Invalidation**: All operations within a transaction share a single cache clear
- **Skip Flags**: Operations pass `skipCacheInvalidation = true` to defer clearing
- **Automatic Batching**: The `executeTransaction` method handles batching transparently
- **Rollback Efficiency**: Failed transactions still only trigger one cache clear

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
- `pixelToHex(point)` - Find hex at position
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
