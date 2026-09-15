# Pathfinding

## Overview

The pathfinding system provides movement distances and closest-target selection for the hexagonal grid. The library (`/src/lib/pathfinding.ts`) is pure and grid-agnostic, reading tiles through callbacks; each board's context memoizes the resulting closest-target maps for the arrows overlay and the debug panel.

## Design Principles

1. **Pure Functions**: Library functions are side-effect free and uncached; every call computes from the tiles it is given
2. **Grid via Callbacks**: `getTile` and `canTraverse` callbacks decouple the algorithms from the `Grid` class
3. **Algorithm Specialization**: BFS answers how many moves until a target is in range; A\* reconstructs a concrete path and serves only the debug panel
4. **Bounded Search**: A\* aborts past 1000 discovered nodes and BFS past 20 moves, both reporting the target as unreachable
5. **Deterministic, Team-Asymmetric Tie-Breaking**: Equidistant targets resolve by fixed rules whose hex-id preference flips with the source team

## Core Algorithms (`/src/lib/pathfinding.ts`)

### Traversal

`defaultCanTraverse` treats `BLOCKED` and `BLOCKED_BREAKABLE` tiles as impassable; occupied tiles are walkable.

### A\* (`findPathAStar`)

- **Heuristic**: hex distance to the goal (admissible, so paths are optimal); every step costs 1
- **Open set**: min-heap `PriorityQueue` (`/src/lib/priorityQueue.ts`) ordered by f-cost
- **Result**: the hex list from start to goal inclusive, or `null` when the goal is unreachable or more than 1000 nodes have been discovered

### BFS Movement Distance (`calculateRangedMovementDistance`)

Returns the minimum number of moves before any target lies within `range`, plus every target reachable at that distance so tie-breaking can choose among them:

- **Zero moves**: any target already within `range` of the start returns distance 0 without searching
- **Frontier search**: level-by-level BFS over traversable neighbours; the first level from which a target is within `range` wins
- **Cutoff**: gives up after 20 moves with `movementDistance: Infinity` and `canReach: false`

Melee (range 1) therefore needs an adjacent tile; ranged units stop at their maximum range.

## Target Selection

### `findClosestTarget`

Runs the BFS from the source tile against all target tiles at the source's range, then applies the tie-breaking rules to the targets tied at the minimum distance. The source tile's team decides the hex-id preference, so the same layout resolves differently for the two sides.

### Tie-Breaking Rules

Candidates are folded left to right, each compared with the current best:

| Case                                                       | Rule                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Exactly one is vertically aligned (same `q` as the source) | The vertical one wins                                                     |
| Both on the same diagonal (same `q - r`)                   | ALLY source prefers the higher hex id, ENEMY source the lower             |
| Neither vertical, different diagonals                      | Smaller hex distance to the source; on a tie, the same team id preference |
| Both vertical, different diagonals                         | No rule applies; the earlier candidate stays                              |

The distance in the third case is hex (cube) distance, not path length.

## Closest-Target Maps

### `getClosestTargetMap`

Runs `findClosestTarget` for every source-team tile and returns `Map<sourceHexId, TargetInfo>`:

```typescript
interface TargetInfo {
  enemyHexId?: number // set when the target team is ENEMY
  allyHexId?: number // set when the target team is ALLY
  distance: number
}
```

- **Range**: per-character ranges come from the caller's `characterRanges` map; a missing entry means melee (1)
- **Consumers**: `GridArrows.vue` draws an arrow per entry of both maps; `DebugPanel.vue` lists them

### Memoization (`/src/composables/useGridContext.ts`)

- **Per board**: `closestEnemyMap` (ALLY to ENEMY) and `closestAllyMap` (ENEMY to ALLY) are `computed`, so they recompute only when the placements, tile states, or ranges they read change (character operations, tile painting, map switches) and can never go stale
- **Namespaced ranges**: `buildUnitRanges` seeds the base-id keyed static range map with an entry per on-grid companion, phantimal, or synergy copy, so those units target at their own range instead of falling back to melee
- **Pathfinding store** (`/src/stores/pathfinding.ts`): adapts the active board's maps for the debug panel and computes `debugPathfindingResults`, the A\* path from each source to its chosen target in both directions

Skill targeting (`/src/lib/skills/utils/distance.ts`) does not use these maps; its FURTHEST picks break distance ties with the opposite hex-id preference (ALLY lower, ENEMY higher).

## Related Documentation

- [`/docs/architecture/GRID.md`](./GRID.md) - Hexagonal coordinates, hex ids, and tile states
- [`/docs/architecture/SKILLS.md`](./SKILLS.md) - Skill targeting utilities
