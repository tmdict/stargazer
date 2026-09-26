# Pathfinding

Pathfinding answers one question for every unit on a board: which enemy would it attack first? The answer draws the attack arrows (`GridArrows`) and fills the debug panel. The hard parts are resolving ties the same way every time and giving each kind of unit its own range.

`src/lib/pathfinding.ts` is pure and knows nothing about `Grid`. It reads tiles through `getTile` and `canTraverse` callbacks and caches nothing.

## Closest target

`findClosestTarget` asks how many moves a unit needs before some target is within its range. A target already in range costs zero moves. Otherwise a breadth-first search expands one move at a time, and the first level from which any target is within range wins. Every target reachable at that level stays a candidate for tie-breaking.

Three details decide the results:

- Blocked and breakable-blocked tiles cannot be crossed. Occupied tiles can, so units walk through each other.
- Range is plain hex distance, with no line of sight, so a ranged unit can reach over a wall.
- The search gives up after 20 moves and reports the target as unreachable, which draws no arrow.

A melee unit (range 1) therefore has to reach an adjacent tile, and a ranged unit stops at its maximum range.

## Tie-breaking

The tied candidates are folded left to right in grid storage order, each compared with the current best:

| Case                                             | Rule                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| Exactly one is in the source's column (same `q`) | The one in the column wins                                          |
| Both on the same diagonal row (same `q - r`)     | An ally source prefers the higher hex id, an enemy source the lower |
| Neither in the column, different diagonals       | Smaller hex distance wins, then the same hex-id preference          |
| Both in the column                               | The earlier candidate stays                                         |

The distance in the third case is the straight hex distance to the source rather than the path length. The hex-id preference depends on the source's team, so the same layout can resolve differently for the two sides, which mirrors the board's 180° symmetry.

## Ranges per unit

`getClosestTargetMap` takes a range map keyed by unit id, and a unit missing from it counts as melee. The static range map from game data is keyed by base hero id, so `buildUnitRanges` (`src/composables/useGridContext.ts`) adds an entry for every companion, phantimal and synergy copy on the board, taken from `gameData.getCharacterRange`. Without that, those units would silently fall back to range 1. Where a companion's or phantimal's range comes from is covered in [Companion Skills](./skills/COMPANION.md) and [Seasonal Content](./SEASONAL.md).

## Per-board maps

Each board computes two maps, ally to enemy and enemy to ally, as Vue computeds over its tiles and ranges. They recompute whenever a placement, tile state or map changes, so they cannot go stale. The pathfinding store only adapts the active board's maps for the debug panel.

`findPathAStar` reconstructs an actual path to the chosen target and serves only the debug panel. It uses hex distance as its heuristic, costs every step 1, and gives up once it has discovered more than 1000 nodes.

## Skill targeting is separate

Skill targeting (`src/lib/skills/utils/distance.ts`) does not use these maps. Its furthest-unit picks break distance ties with the opposite hex-id preference (an ally caster prefers the lower id, an enemy the higher). See [Targeting Skills](./skills/TARGETING.md).

## Related documentation

- [Grid & Characters](./GRID.md): hex coordinates, tile states and the fixed board orientation
- [Targeting Skills](./skills/TARGETING.md): how skills pick their targets
