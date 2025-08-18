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
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Components    │────▶│  Store Layer     │────▶│Domain Layer │
│                 │     │                  │     │             │
│ - GridTiles     │     │ - Grid Store     │     │ - Grid      │
│ - GridManager   │     │ - Character Store│     │ - Character │
│ - DragDrop      │     │ - Reactive state │     │   Manager   │
└─────────────────┘     └──────────────────┘     └──────┬──────┘
                                                        │
                        ┌───────────────────────────────┼────────────┐
                        ▼                               ▼            ▼
                ┌─────────────┐                ┌─────────────┐  ┌──────────┐
                │    Teams    │                │  Companions │  │  Skills  │
                │             │                │             │  │          │
                │ - Capacity  │                │ - Linking   │  │ - Auto   │
                │ - Tracking  │                │ - Cleanup   │  │  activate│
                └─────────────┘                └─────────────┘  └──────────┘
```

## Core Components

### Grid Class (`/src/lib/grid.ts`)

The central state manager for tile and character data:

```typescript
class Grid {
  private storage: Map<string, GridTile>
  private teamCharacters: Map<Team, Set<number>>
  private companionLinks: Map<string, Set<number>>

  // Core operations
  placeCharacter(hexId, characterId, team): boolean
  removeCharacter(hexId): void
  swapCharacters(fromHexId, toHexId): boolean
  executeTransaction(operations, rollbacks): boolean
}
```

### Character Manager (`/src/lib/character.ts`)

Functional API that integrates skills with grid operations:

```typescript
// All operations handle skills automatically
placeCharacter(grid, skillManager, hexId, characterId, team)
removeCharacter(grid, skillManager, hexId)
swapCharacters(grid, skillManager, fromHexId, toHexId)
moveCharacter(grid, skillManager, fromHexId, toHexId, characterId)
```

Key features:

- **Automatic skill activation** on character placement
- **Skill deactivation** before removal with cleanup
- **Cross-team movement** with skill state transitions
- **Companion handling** for linked characters

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

### Placement

Character placement with skill integration:

```typescript
function placeCharacter(grid, skillManager, hexId, characterId, team) {
  return grid.executeTransaction([
    () => grid.placeCharacter(hexId, characterId, team, true),
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

- **Within team**: Direct grid movement
- **Cross-team**: Deactivate skill → move → reactivate skill
- **Swapping**: Atomic exchange with skill handling for affected characters

### Removal

Cascading removal for linked characters:

1. Check if character is a companion
2. If companion, find and remove main character
3. Deactivate skills before removal
4. Remove all linked companions
5. Clean up team tracking

## Team & Companion Systems

### Team Management

Teams tracked separately for performance:

```typescript
private teamCharacters: Map<Team, Set<number>> = new Map([
  [Team.ALLY, new Set()],
  [Team.ENEMY, new Set()],
])
```

Features:

- **Team Types**: `ALLY` and `ENEMY`
- **Capacity**: Default 5, expandable by skills
- **Duplicate Prevention**: Same character cannot exist twice on one team

### Companion System

Grid supports skill-created linked characters. See [`/docs/architecture/SKILLS.md`](./SKILLS.md) for implementation details.

## Transaction System

Complex operations use transactions for atomicity:

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

## Integration Points

### Drag & Drop

- Character data includes `sourceHexId` for tracking
- Validation through `canPlaceCharacter()`
- Visual feedback via tile states

### Pathfinding

- Blocked tiles for obstacles
- Character positions for targeting
- Team information for friend/foe detection
- Character ranges from gameData store

### Skills

- Automatic activation/deactivation
- Companion placement and linking
- Team capacity modifications
- Visual color modifiers

### URL Serialization

- Compact binary format for sharing
- Preserves all placements and teams
- Maintains companion relationships

## Performance Considerations

- **Map storage**: O(1) tile access by coordinate key
- **Set-based teams**: O(1) membership checks
- **Cache batching**: Single pathfinding cache clear per transaction (not per operation)
- **Pre-allocated rollbacks**: Minimal allocation during operations
- **Granular reactive state**: Character store uses separate computed properties to minimize recalculations

## Related Documentation

- [`/docs/architecture/SKILLS.md`](./SKILLS.md) - Skill system and visual effects
- [`/docs/architecture/PATHFINDING.md`](./PATHFINDING.md) - Pathfinding algorithms
- [`/docs/architecture/DRAG_AND_DROP.md`](./DRAG_AND_DROP.md) - Drag and drop system
- [`Hexagonal Grids`](https://www.redblobgames.com/grids/hexagons/) - Reference guide for this implementation
