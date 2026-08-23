# Pathfinding

## Overview

The pathfinding system provides movement calculations, target selection, and distance computations for the hexagonal grid. It uses specialized algorithms for different scenarios while maintaining framework independence through pure functional design.

## Design Principles

1. **Pure Functions**: All functions are side-effect free and stateless
2. **Algorithm Specialization**: A\* for specific paths, BFS for closest targets
3. **Performance First**: Early termination and optimized data structures
4. **Framework Agnostic**: Works with any grid via callback functions
5. **Deterministic Behavior**: Consistent tie-breaking rules for predictable outcomes
6. **Team Asymmetry**: Different targeting preferences based on attacking team

## Core Algorithms

### A\* Implementation (`/src/lib/pathfinding.ts`)

Finds optimal path between two specific hexes:

```typescript
function findPathAStar(
  start: Hex,
  goal: Hex,
  getTile: (hex: Hex) => GridTile | undefined,
  canTraverse: (tile: GridTile) => boolean,
): Hex[] | null
```

Features:

- **Hex Distance Heuristic**: Admissible for guaranteed optimal paths
- **Binary Heap Priority Queue**: Efficient node selection
- **Early Termination**: Stops when goal reached, or after 1000 explored nodes
- **Null on Impossible**: Returns null for blocked paths

### BFS Distance Calculation

Finds minimum tiles to move before attacking any target:

```typescript
function calculateRangedMovementDistance(
  start: Hex,
  targets: Hex[],
  range: number,
  getTile: (hex: Hex) => GridTile | undefined,
  canTraverse: (tile: GridTile) => boolean,
): { movementDistance: number; canReach: boolean; reachableTargets: Hex[] }
```

Handles both melee (range 1) and ranged attacks by finding positions within attack range. Every target reachable at the minimum distance is returned so tie-breaking can choose among them; the search gives up after 20 moves.

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
  tilesWithCharacters: GridTile[],
  sourceTeam: Team,
  targetTeam: Team,
  getTile: (hex: Hex) => GridTile | undefined,
  characterRanges?: Map<number, number>,
): Map<number, TargetInfo>
```

Processes all source-team characters, returning optimal targets based on team and range.

## Memoization Strategy

The library functions are pure and uncached: every call computes from the grid state it is given. Memoization lives one layer up, on each board's context (`/src/composables/useGridContext.ts`), where `closestEnemyMap`/`closestAllyMap` are Vue `computed` properties; the pathfinding store (`/src/stores/pathfinding.ts`) only adapts the active board's maps for the debug panel. They recompute only when the reactive grid state they read (placements, tile states, character ranges) actually changes, so results can never go stale: any mutation that affects targeting (character operations, map-editor tile painting, map switches) invalidates them automatically through Vue's dependency tracking. The per-board range map seeds an entry for every on-grid namespaced unit (companion, phantimal, synergy copy), since the static map is keyed by base hero id.

## Performance Characteristics

- **A\* Complexity**: O(b^d) reduced by heuristic
- **BFS Complexity**: O(V + E) for local exploration
- **Recomputation Cost**: Bounded by the 45-tile board and unit count; recomputes only on relevant reactive changes

## Movement Calculations

### Effective Distance

Number of tiles to move before being in attack range:

- Melee (range 1): Must reach adjacent tile
- Ranged: Can stop at maximum range

### Optimal Positioning

System finds all valid attack positions and selects closest reachable one.
