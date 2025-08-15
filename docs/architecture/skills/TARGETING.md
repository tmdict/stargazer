# Targeting Skills

## Overview

Automatically select and track enemy targets with colored arrows that update when characters move.

## Implementation

Uses three lifecycle methods to manage targeting:

```typescript
onActivate: calculateTarget() → setSkillTarget()
onUpdate: recalculate when grid changes
onDeactivate: clearSkillTarget()
```

Key features:

- Visual feedback via `targetingColorModifier` (arrow color)
- Dynamic updates through `onUpdate` lifecycle
- No border changes - uses arrows only
- Metadata for visual hints (e.g., `isSymmetricalTarget`)

## Examples

**Silvina** (ID: 39) - First Strike:

- Green arrows
- Targets enemy on symmetrical hex position
- Falls back to closest enemy when symmetrical hex is empty
- Uses pre-computed map for O(1) symmetry lookups
- **Spiral search tie-breaking**: When multiple enemies are equidistant from the symmetrical tile, uses a clockwise spiral search pattern:
  - **Ally team**: Walks clockwise starting just after top-right position (q+N, r-N)
  - **Enemy team**: Walks counter-clockwise starting just after bottom-left position (q-N, r+N)
  - Searches expanding rings (distance 1, 2, 3...) until an enemy is found
  - Within each ring, tiles are checked in the appropriate walk order
  - Ensures consistent, predictable targeting behavior

**Vala** (ID: 46) - Assassin:

- Purple arrows
- Targets the furthest opposing character from Vala's position
- **Simple tie-breaking**: When multiple enemies are equidistant at maximum range:
  - Ally team Vala: Prefers lower hex ID
  - Enemy team Vala: Prefers higher hex ID (180° rotation)
- Clean implementation without complex fallback logic

## Utilities

- `symmetry.ts`: Pre-computed hex symmetry map for O(1) lookups
- `targeting.ts`: Generic targeting utilities for simple skills
  - `getOpposingCharacters()`: Get all characters from the opposing team
  - `calculateDistances()`: Calculate distances from reference points
  - `sortByDistancePriorities()`: Sort candidates by distance with simple hex ID tie-breaking
  - `findBestTarget()`: Generic targeting function for skills without special logic
- Note: Complex skills like Silvina implement their own specialized targeting algorithms
