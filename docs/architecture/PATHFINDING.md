# Pathfinding

## Overview

The pathfinding system provides movement calculations, target selection, and distance computations for the hexagonal grid. It uses specialized algorithms for different scenarios while maintaining framework independence through pure functional design.

## Design Principles

1. **Pure Functions**: All functions are side-effect free except module-level caching
2. **Algorithm Specialization**: A\* for specific paths, BFS for closest targets
3. **Performance First**: LRU caching, early termination, optimized data structures
4. **Framework Agnostic**: Works with any grid via callback functions
5. **Deterministic Behavior**: Consistent tie-breaking rules for predictable outcomes
6. **Team Asymmetry**: Different targeting preferences based on attacking team

## Core Algorithms

### A\* Implementation (`/src/lib/pathfinding.ts`)

Finds optimal path between two specific hexes:

```typescript
function aStarHexPath(
  start: Hex,
  goal: Hex,
  getTile: (hex: Hex) => Tile | null,
  canTraverse: (tile: Tile) => boolean,
): Hex[] | null
```

Features:

- **Manhattan Distance Heuristic**: Admissible for guaranteed optimal paths
- **Binary Heap Priority Queue**: Efficient node selection
- **Early Termination**: Stops when goal reached
- **Null on Impossible**: Returns null for blocked paths

### BFS Distance Calculation

Finds minimum tiles to move before attacking any target:

```typescript
function bfsDistanceToTargets(
  source: Hex,
  targets: Hex[],
  range: number,
  getTile: (hex: Hex) => Tile | null,
  canTraverse: (tile: Tile) => boolean,
): Map<number, number>
```

Handles both melee (range 1) and ranged attacks by finding positions within attack range.

## Target Selection

### Tie-Breaking Rules

When multiple targets are equidistant:

1. **Vertical Alignment**: Prefer same q-coordinate (straight vertical movement)
2. **Diagonal Priority**: Within diagonal row, team-based ID preference:
   - **ALLY → ENEMY**: Prefer higher hex ID
   - **ENEMY → ALLY**: Prefer lower hex ID
3. **Direct Distance**: Targets with minimum euclidean distance
4. **ID Fallback**: Team-based preference (same as rule 2)

### Finding Closest Target

```typescript
function findClosestTarget(
  sourceTile: GridTile,
  targetTiles: GridTile[],
  sourceRange: number,
  getTile: (hex: Hex) => GridTile | undefined,
  canTraverse: (tile: GridTile) => boolean,
): { hexId: number; distance: number } | null
```

Combines BFS exploration with team-aware tie-breaking for consistent target selection. The source tile's team determines ID preference during tie-breaking, creating asymmetric targeting behavior between teams.

## Game Integration

### Main API

```typescript
function getClosestTargetMap(
  allies: Character[],
  enemies: Character[],
  gridData: GridData,
): Map<number, TargetInfo>
```

Processes all characters, returning optimal targets based on team and range.

## Caching System

### Multi-Level Caches

- **Path Cache**: A\* path results
- **Distance Cache**: BFS distance calculations
- **Target Cache**: Closest target results

### Cache Keys

Combines position, range, and grid state into compact strings:

```typescript
const key = `${sourceId}-${targetId}-${range}-${gridHash}`
```

### Invalidation

Call `clearPathfindingCache()` when grid state changes significantly.

## Performance Characteristics

- **A\* Complexity**: O(b^d) reduced by heuristic
- **BFS Complexity**: O(V + E) for local exploration
- **Cached Queries**: O(1) lookup time
- **Memory Bounded**: LRU eviction prevents growth

## Movement Calculations

### Effective Distance

Number of tiles to move before being in attack range:

- Melee (range 1): Must reach adjacent tile
- Ranged: Can stop at maximum range

### Optimal Positioning

System finds all valid attack positions and selects closest reachable one.
